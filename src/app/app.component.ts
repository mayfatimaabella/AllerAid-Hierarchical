import { Component, OnInit } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AllergyService } from './core/services/allergy.service';
import { AuthService } from './core/services/auth.service';
import { UserService } from './core/services/user.service';
import { EmergencyDetectorService } from './core/services/emergency-detector.service';
import { PatientNotificationService } from './core/services/patient-notification.service';
import { MedicationReminderService } from './core/services/medication-reminder.service';
import { PushNotificationService } from './core/services/push-notification.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  userRole: string = '';

  constructor(
    private menuController: MenuController, 
    private allergyService: AllergyService,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private emergencyDetectorService: EmergencyDetectorService,
    private patientNotificationService: PatientNotificationService,
    private pushNotificationService: PushNotificationService,
    private medicationReminderService: MedicationReminderService
  ) {
    this.allergyService.resetAllergyOptions();
    // Initialize emergency detection on app startup
    this.initializeEmergencyDetection();
    // Initialize patient notification listening
    this.initializePatientNotifications();
    // Initialize medication notification listening
    this.initializeMedicationNotifications();
  }

  async ngOnInit() {
    // Wait for Firebase Auth to finish restoring any saved session
    const user = await this.authService.waitForAuthInit();

    if (user) {
      // Ensure role is loaded for an authenticated user
      await this.loadUserRole();

      // If the app started on the login screen, redirect to the main area
      if (this.router.url === '/login' || this.router.url === '/') {
        await this.router.navigate(['/tabs'], { replaceUrl: true });
      }
    } else {
      this.userRole = '';

      // If there is no authenticated user, make sure we are on the login page
      if (this.router.url !== '/login') {
        await this.router.navigate(['/login'], { replaceUrl: true });
      }
    }

    // Keep reacting to auth changes (e.g., after login/logout while app is open)
    this.authService.getCurrentUser$().subscribe(async (currentUser) => {
      if (currentUser) {
        await this.loadUserRole();
        // Ensure push notifications are registered once the user is authenticated
        await this.pushNotificationService.init();
      } else {
        this.userRole = '';
      }
    });
  }

  private async loadUserRole() {
    try {
      const userProfile = await this.userService.getCurrentUserProfile();
      this.userRole = userProfile?.role || '';
    } catch (error) {
      console.error('Error loading user role:', error);
      this.userRole = '';
    }
  }
  
  private async initializeEmergencyDetection() {
    // The service will auto-initialize when injected
    console.log('Emergency detector service initialized in app component');
  }

  private async initializePatientNotifications() {
    // Wait for user authentication
    this.authService.getCurrentUser$().subscribe(async (user) => {
      if (user) {
        // Start listening for buddy responses when user is authenticated
        await this.patientNotificationService.startListeningForBuddyResponses();
        console.log('Patient notification service initialized');
      } else {
        // Stop listening when user logs out
        this.patientNotificationService.stopListeningForBuddyResponses();
        console.log('Patient notification service stopped');
      }
    });
  }

  private async initializeMedicationNotifications() {
    // Wait for user authentication
    this.authService.getCurrentUser$().subscribe((user) => {
      if (user) {
        // Start listening for medication notifications when user is authenticated
        this.medicationReminderService.startListeningForNotifications();
        console.log('Medication notification listener initialized');
      } else {
        // Stop listening when user logs out
        this.medicationReminderService.stopListeningForNotifications();
        console.log('Medication notification listener stopped');
      }
    });
  }

  onMenuItemClick() {
    this.menuController.close();
  }

  async logout() {
    try {
      console.log('Attempting to log out...');
      await this.authService.signOut();
      await this.menuController.close();
      console.log('Navigating to login page...');
      await this.router.navigate(['/login'], { replaceUrl: true });
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Still close menu and navigate even if there's an error
      await this.menuController.close();
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}