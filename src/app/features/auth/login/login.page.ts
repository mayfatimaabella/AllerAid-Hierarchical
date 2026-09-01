import { Component, OnInit } from '@angular/core';
import {
  ToastController,
  NavController,
  LoadingController,
  AlertController,
  ModalController
} from '@ionic/angular';

import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ForgotPasswordModal } from './forgot-password.modal';
import { MedicalService } from '../../../core/services/medical.service';

import { AllergyOnboardingService } from '../../../core/services/allergy-onboarding.service';


@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {

  email: string = '';
  password: string = '';

  // Used to show validation messages after clicking Login
  submitted: boolean = false;

  constructor(
    private toastController: ToastController,
    private navCtrl: NavController,
    private userService: UserService,
    private authService: AuthService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private modalController: ModalController,
    private medicalService: MedicalService,
    private allergyOnboardingService: AllergyOnboardingService
  ) {}

  ngOnInit() {
    this.clearForm();
  }

  ionViewWillEnter() {
    this.clearForm();
  }

  /**
   * Clear login form
   */
  clearForm() {
    this.email = '';
    this.password = '';
    this.submitted = false;
  }

  /**
   * Validate email format
   */
  isValidEmail(): boolean {
    if (!this.email) {
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailRegex.test(this.email);
  }

  /**
   * Called when user types in email field
   */
  clearEmailError() {
    // Angular automatically updates the *ngIf conditions.
    // This method is here so you can extend the behavior later.
  }

  /**
   * Called when user types in password field
   */
  clearPasswordError() {
    // Angular automatically updates the *ngIf conditions.
  }

  /**
   * Login
   */
  async login() {

    // Mark the form as submitted.
    // This allows validation messages to appear.
    this.submitted = true;

    // Required field validation
    if (!this.email || !this.password) {
      return;
    }

    // Email format validation
    if (!this.isValidEmail()) {
      return;
    }

    let loading: HTMLIonLoadingElement | null = null;

    try {

      // Show loading indicator
      loading = await this.loadingController.create({
        message: 'Signing in...',
        spinner: 'crescent'
      });

      await loading.present();

      console.log('Attempting to sign in...');

      // Firebase authentication
      const userCredential = await this.authService.signIn(
        this.email.trim(),
        this.password
      );

      if (!userCredential.user) {
        throw {
          code: 'auth/user-not-found',
          message: 'Unable to sign in.'
        };
      }

      console.log(
        'User authenticated:',
        userCredential.user.uid
      );

      // Get user profile from database
      const userProfile = await this.userService.getUserProfile(userCredential.user.uid);

      /**
       * Check email verification.
       *
       * Admin accounts are allowed to log in without
       * email verification.
       */
      if (!userCredential.user.emailVerified && userProfile?.role !== 'admin') {

        await this.authService.signOut();

        throw {
          code: 'auth/email-not-verified',
          message:
            'Please verify your email address before logging in.'
        };
      }

      /**
       * User authenticated but profile doesn't exist.
       */
      if (!userProfile) {

        await this.authService.signOut();

        throw {
          code: 'account/setup-incomplete',
          message:
            'Account setup incomplete. Please register again.'
        };
      }

      console.log(
        'User profile loaded:',
        userProfile
      );

      // Update last login
      await this.userService.updateLastLogin(
        userCredential.user.uid
      );

      /**
       * Save current user locally
       */
      localStorage.setItem(
        'currentUser',
        JSON.stringify({
          uid: userProfile.uid,
          email: userProfile.email,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          fullName: userProfile.fullName,
          role: userProfile.role
        })
      );

      // Login successful
      await this.presentToast(
        'Login successful!',
        'success',
        2500,
        'checkmark-circle-outline'
      );

      /**
       * Redirect based on role
       */

      // ADMIN
      if (userProfile.role === 'admin') {

        this.navCtrl.navigateRoot(
          '/admin-dashboard'
        );

        return;
      }

      // USER
      if (userProfile.role === 'user') {

        const hasCompletedOnboarding = await this.allergyOnboardingService.hasCompletedAllergyOnboarding(userProfile.uid);

        if (!hasCompletedOnboarding) {

          this.navCtrl.navigateRoot('/allergy-onboarding');

          return;
        }

        this.navCtrl.navigateRoot('/tabs/home');

        return;
      }

      // DOCTOR
      if (userProfile.role === 'doctor') {

        this.navCtrl.navigateRoot('/tabs/doctor-dashboard');

        return;
      }

      // Unknown role
      this.navCtrl.navigateRoot('/login');

    } catch (error: any) {

      console.error(
        'Login error:',
        error
      );

      /**
       * Email not verified
       */
      if (
        error?.code ===
        'auth/email-not-verified'
      ) {

        await this.presentErrorAlert(
          'Email Not Verified',
          'Please verify your email address before logging in. Would you like us to resend the verification email?',
          [
            {
              text: 'Cancel',
              role: 'cancel'
            },
            {
              text: 'Resend',
              handler: async () => {
                await this.resendVerificationEmail();
              }
            }
          ]
        );

        return;
      }

      /**
       * Get appropriate toast message
       */
      const {
        message,
        color,
        icon,
        duration
      } = this.getErrorToastConfig(error);

      await this.presentToast(
        message,
        color,
        duration,
        icon
      );

    } finally {

      /**
       * Always dismiss loading indicator.
       */
      if (loading) {

        try {
          await loading.dismiss();
        } catch (e) {
          console.log(
            'Loading already dismissed.'
          );
        }

      } else {

        const top =
          await this.loadingController.getTop();

        if (top) {
          await top.dismiss();
        }
      }
    }
  }

  /**
   * Open Forgot Password Modal
   */
  async openForgotPasswordModal(): Promise<void> {

    const modal =
      await this.modalController.create({
        component: ForgotPasswordModal,
        cssClass: 'forgot-password-modal'
      });

    await modal.present();
  }

  /**
   * Present Ionic Toast
   */
  async presentToast(
    message: string,
    color: string = 'medium',
    duration: number = 3000,
    icon?: string
  ) {

    const toast =
      await this.toastController.create({
        message,
        duration,
        position: 'bottom',
        color,
        icon
      });

    await toast.present();
  }

  /**
   * Firebase error -> Toast configuration
   */
  private getErrorToastConfig(
    error: any
  ): {
    message: string;
    color: string;
    icon?: string;
    duration: number;
  } {

    const code =
      error?.code as string | undefined;

    switch (code) {

      case 'auth/user-not-found':
        return {
          message:
            'No account found with this email.',
          color: 'warning',
          icon: 'person-circle-outline',
          duration: 3500
        };

      case 'auth/wrong-password':
        return {
          message:
            'Incorrect password. Please try again.',
          color: 'danger',
          icon: 'key-outline',
          duration: 3500
        };

      case 'auth/invalid-credential':
        return {
          message:
            'Incorrect email or password. Please try again.',
          color: 'danger',
          icon: 'lock-closed-outline',
          duration: 3500
        };

      case 'auth/invalid-email':
        return {
          message:
            'Invalid email format.',
          color: 'warning',
          icon: 'mail-outline',
          duration: 3000
        };

      case 'auth/too-many-requests':
        return {
          message:
            'Too many attempts. Try again later.',
          color: 'medium',
          icon: 'time-outline',
          duration: 4000
        };

      case 'auth/network-request-failed':
        return {
          message:
            'Network error. Check your connection.',
          color: 'warning',
          icon: 'wifi-outline',
          duration: 3500
        };

      case 'account/setup-incomplete':
        return {
          message:
            'Account setup incomplete. Please register again.',
          color: 'warning',
          icon: 'person-outline',
          duration: 4000
        };

      default:
        return {
          message:
            'Unable to sign in. Please try again.',
          color: 'medium',
          icon: 'alert-circle-outline',
          duration: 3500
        };
    }
  }

  /**
   * Present Alert
   */
  async presentErrorAlert(
    header: string,
    message: string,
    buttons: any[] = ['OK']
  ) {

    const alert =
      await this.alertController.create({
        header,
        message,
        buttons
      });

    await alert.present();
  }

  /**
   * Resend verification email
   */
  private async resendVerificationEmail() {

    try {

      const maybeMethod: any =
        this.authService as any;

      if (
        typeof maybeMethod.resendVerificationEmail ===
        'function'
      ) {

        await maybeMethod.resendVerificationEmail(
          this.email
        );

      } else if (
        typeof maybeMethod.sendEmailVerification ===
        'function'
      ) {

        await maybeMethod.sendEmailVerification(
          this.email
        );
      }

      await this.presentToast(
        'Verification email sent. Please check your inbox.',
        'success',
        3500,
        'mail-outline'
      );

    } catch (e: any) {

      await this.presentToast(
        `Failed to send verification email: ${
          e?.message || 'Unknown error'
        }`,
        'danger',
        4000,
        'alert-circle-outline'
      );
    }
  }
}
