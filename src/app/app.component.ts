import { Component, OnInit } from '@angular/core';
import {
  MenuController,
  LoadingController
} from '@ionic/angular';
import { Router } from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { UserService } from './core/services/user.service';
import { PatientNotificationService } from './core/services/patient-notification.service';
import { MedicationReminderService } from './core/services/medication-reminder.service';
import { MedicationService } from './core/services/medication.service';
import { PushNotificationService } from './core/services/push-notification.service';

import { SplashScreen } from '@capacitor/splash-screen';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {

  userRole: string = '';
  showStartupScreen = true;

  private startupLoading?: HTMLIonLoadingElement;

  constructor(
    private menuController: MenuController,
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private patientNotificationService: PatientNotificationService,
    private loadingController: LoadingController,
    private pushNotificationService: PushNotificationService,
    private medicationReminderService: MedicationReminderService,
    private medicationService: MedicationService,
  ) {

    // Initialize emergency detection on app startup
    this.initializeEmergencyDetection();

    // Initialize patient notification listening
    this.initializePatientNotifications();

    // Initialize medication notification listening
    this.initializeMedicationNotifications();
  }

  async ngOnInit() {

    // ---------------------------------------------------------
    // STARTUP LOADING
    // ---------------------------------------------------------

    this.startupLoading = await this.loadingController.create({
      message: 'Loading your account...',
      spinner: 'crescent',
      backdropDismiss: false,
      cssClass: 'alleraid-startup-loading'
    });

    await this.startupLoading.present();

    await SplashScreen.hide();

    try {

      console.log('Starting app initialization...');

      // -------------------------------------------------------
      // WAIT FOR FIREBASE TO RESTORE AUTHENTICATION
      // -------------------------------------------------------

      const user = await this.authService.waitForAuthInit();

      console.log(
        'Firebase restored user:',
        user?.email ?? 'NO USER'
      );

      // -------------------------------------------------------
      // USER IS ALREADY LOGGED IN
      // -------------------------------------------------------

      if (user) {

        await this.loadUserRole();

        console.log(
          'Restored user role:',
          this.userRole
        );

        // -----------------------------------------------------
        // IMPORTANT:
        // If the app opens on /login or /,
        // redirect the already-authenticated user.
        // -----------------------------------------------------

        if (
          this.router.url === '/login' ||
          this.router.url === '/'
        ) {

          console.log(
            'Authenticated user is on login/start page.'
          );

          switch (this.userRole) {

            case 'user':

              console.log(
                'Redirecting user to /tabs'
              );

              await this.router.navigate(
                ['/tabs/home'],
                { replaceUrl: true }
              );

              break;

            case 'doctor':

              console.log(
                'Redirecting doctor to /doctor-dashboard'
              );

              await this.router.navigate(
                ['/doctor-dashboard'],
                { replaceUrl: true }
              );

              break;

            case 'admin':

              console.log(
                'Redirecting admin to /admin-dashboard'
              );

              await this.router.navigate(
                ['/admin-dashboard'],
                { replaceUrl: true }
              );

              break;

            default:

              console.warn(
                'Authenticated user has no recognized role:',
                this.userRole
              );

              break;
          }
        }

      }

      // -------------------------------------------------------
      // NO AUTHENTICATED USER
      // -------------------------------------------------------

      else {

        console.log(
          'No authenticated session found.'
        );

        this.userRole = '';

      }

    } catch (error) {

      console.error(
        'App initialization error:',
        error
      );

    } finally {

      // -------------------------------------------------------
      // HIDE STARTUP LOADING
      // -------------------------------------------------------

      if (this.startupLoading) {

        await this.startupLoading.dismiss();

        this.startupLoading = undefined;
      }

      this.showStartupScreen = false;
    }

    // ---------------------------------------------------------
    // CONTINUE LISTENING FOR AUTHENTICATION CHANGES
    // ---------------------------------------------------------

    this.authService.getCurrentUser$().subscribe(
      async (currentUser) => {

        if (currentUser) {

          console.log(
            'Authentication listener:',
            currentUser.email
          );

          await this.loadUserRole();

          console.log(
            'Current user role:',
            this.userRole
          );

          // Initialize push notifications
          await this.pushNotificationService.init();

        } else {

          console.log(
            'Authentication listener: user logged out'
          );

          this.userRole = '';
        }
      }
    );
  }

  // =========================================================
  // LOAD USER ROLE
  // =========================================================

  private async loadUserRole() {

    try {

      const userProfile =
        await this.userService.getCurrentUserProfile();

      this.userRole =
        userProfile?.role || '';

      console.log(
        'User profile role:',
        this.userRole
      );

    } catch (error) {

      console.error(
        'Error loading user role:',
        error
      );

      this.userRole = '';
    }
  }

  // =========================================================
  // EMERGENCY DETECTION
  // =========================================================

  private async initializeEmergencyDetection() {

    // The emergency detector service
    // will auto-initialize when injected.

    console.log(
      'Emergency detector service initialized in app component'
    );
  }

  // =========================================================
  // PATIENT NOTIFICATIONS
  // =========================================================

  private async initializePatientNotifications() {

    this.authService.getCurrentUser$().subscribe(
      async (user) => {

        if (user) {

          // Start listening for buddy responses
          await this.patientNotificationService
            .startListeningForBuddyResponses();

          console.log(
            'Patient notification service initialized'
          );

        } else {

          // Stop listening when user logs out
          this.patientNotificationService
            .stopListeningForBuddyResponses();

          console.log(
            'Patient notification service stopped'
          );
        }
      }
    );
  }

  // =========================================================
  // MEDICATION NOTIFICATIONS
  // =========================================================

  private async initializeMedicationNotifications() {

    this.authService.getCurrentUser$().subscribe(
      async (user) => {

        if (user) {

          // Start listening for medication notifications
          this.medicationReminderService
            .startListeningForNotifications();

          console.log(
            'Medication notification listener initialized'
          );

          try {

            const meds =
              await this.medicationService
                .getUserMedications();

            const activeMeds =
              meds.filter(
                med =>
                  med.isActive &&
                  (med.quantity ?? 0) > 0
              );

            await this.medicationReminderService
              .rescheduleAll(activeMeds);

            console.log(
              `Rescheduled reminders for ${activeMeds.length} active medication(s)`
            );

          } catch (error) {

            console.error(
              'Error rescheduling medication reminders on startup:',
              error
            );
          }

        } else {

          // Stop listening when user logs out
          this.medicationReminderService
            .stopListeningForNotifications();

          console.log(
            'Medication notification listener stopped'
          );
        }
      }
    );
  }

  // =========================================================
  // MENU
  // =========================================================

  onMenuItemClick() {

    this.menuController.close();
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async logout() {

    try {

      console.log(
        'Attempting to log out...'
      );

      await this.authService.signOut();

      await this.menuController.close();

      console.log(
        'Navigating to login page...'
      );

      await this.router.navigate(
        ['/login'],
        { replaceUrl: true }
      );

      console.log(
        'User logged out successfully'
      );

    } catch (error) {

      console.error(
        'Logout error:',
        error
      );

      await this.menuController.close();

      await this.router.navigate(
        ['/login'],
        { replaceUrl: true }
      );
    }
  }
}