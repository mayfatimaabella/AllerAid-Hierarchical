import { Component, OnInit} from '@angular/core';
import { MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { UserService } from './core/services/user.service';
import { PatientNotificationService } from './core/services/patient-notification.service';
import { MedicationReminderService } from './core/services/medication-reminder.service';
import { MedicationService } from './core/services/medication.service';
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
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private patientNotificationService: PatientNotificationService,
    private pushNotificationService: PushNotificationService,
    private medicationReminderService: MedicationReminderService,
    private medicationService: MedicationService
  ) {
    // this.allergyService.resetAllergyOptions();
    // Initialize emergency detection on app startup
    this.initializeEmergencyDetection();
    // Initialize patient notification listening
    this.initializePatientNotifications();
    // Initialize medication notification listening
    this.initializeMedicationNotifications();
  }

async ngOnInit() {

  console.log('======================================');
  console.log('APP INITIALIZATION');
  console.log('======================================');

  // Wait for Firebase to restore the saved login session
  const user = await this.authService.waitForAuthInit();

  console.log(
    'Firebase restored user:',
    user?.email ?? 'NO USER'
  );

  if (user) {

    // Load user's Firestore profile/role
    await this.loadUserRole();

    console.log(
      'Restored user role:',
      this.userRole
    );

    /*
     * Firebase restored a logged-in user.
     *
     * If Angular started us on the login page,
     * send the user back into the application.
     */
    if (
      this.router.url === '/login' ||
      this.router.url === '/' ||
      this.router.url === ''
    ) {

      if (this.userRole === 'user') {

        console.log(
          'Restored patient session. Navigating to /tabs/home'
        );

        await this.router.navigate(
          ['/tabs/home'],
          { replaceUrl: true }
        );

      } else if (this.userRole === 'doctor') {

        console.log(
          'Restored doctor session. Navigating to /doctor-dashboard'
        );

        await this.router.navigate(
          ['/doctor-dashboard'],
          { replaceUrl: true }
        );

      } else if (this.userRole === 'admin') {

        /*
         * Admin uses the website, so don't send the
         * admin account into the patient mobile app.
         */
        console.log(
          'Admin account detected. Admin uses the web application.'
        );

      } else {

        console.warn(
          'Authenticated user has no recognized role:',
          this.userRole
        );
      }
    }

  } else {

    console.log(
      'No Firebase session found.'
    );

    this.userRole = '';
  }


  /*
   * Continue listening for login/logout changes
   * while the app is running.
   */
  this.authService.getCurrentUser$().subscribe(
    async (currentUser) => {

      if (currentUser) {

        console.log(
          'Auth state changed:',
          currentUser.email
        );

        await this.loadUserRole();

        // Initialize push notifications after login
        await this.pushNotificationService.init();

      } else {

        console.log(
          'Auth state changed: logged out'
        );

        this.userRole = '';
      }
    }
  );
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
    this.authService.getCurrentUser$().subscribe(async (user) => {
      if (user) {
        // Start listening for medication notifications when user is authenticated
        this.medicationReminderService.startListeningForNotifications();
        console.log('Medication notification listener initialized');

        try {
          const meds = await this.medicationService.getUserMedications();
          const activeMeds = meds.filter(m => m.isActive && (m.quantity ?? 0) > 0);
          await this.medicationReminderService.rescheduleAll(activeMeds);
          console.log(`Rescheduled reminders for ${activeMeds.length} active medication(s)`);
        } catch (error) {
          console.error('Error rescheduling medication reminders on startup:', error);
        }
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
      
      await this.menuController.close();
      await this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}