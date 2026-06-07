import { Component, OnInit } from '@angular/core';
import { ToastController, NavController, LoadingController, AlertController, ModalController } from '@ionic/angular';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ForgotPasswordModal } from './forgot-password.modal';
import { MedicalService } from '../../../core/services/medical.profile.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  email: string = '';
  password: string = '';

  constructor(
    private toastController: ToastController,
    private navCtrl: NavController,
    private userService: UserService,
    private authService: AuthService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private modalController: ModalController,
    private medicalService: MedicalService
  ) {}

  ngOnInit() {
    this.clearForm();
  }

  ionViewWillEnter() {
    this.clearForm();
  }

  clearForm() {
    this.email = '';
    this.password = '';
  }

  async login() {
    if (!this.email || !this.password) {
      this.presentToast('Email and password are required');
      return;
    }

    try {
      const loading = await this.loadingController.create({
        message: 'Signing in...',
        spinner: 'crescent'
      });
      await loading.present();

      console.log('Attempting to sign in...');
      const userCredential = await this.authService.signIn(this.email, this.password);

      if (userCredential.user) {
        console.log('User authenticated:', userCredential.user.uid);

        const userProfile = await this.userService.getUserProfile(userCredential.user.uid);
        
        if (!userCredential.user.emailVerified && userProfile?.role !== 'admin') {
        await this.authService.signOut();

        throw {
          code: 'auth/email-not-verified',
          message: 'Please verify your email address before logging in.'
        };
      }

        if (!userProfile) {
          this.presentToast('Account setup incomplete. Please register again.');
          await this.authService.signOut();
          return;
        }

        console.log('User profile loaded:', userProfile);

        await this.userService.updateLastLogin(userCredential.user.uid);

        localStorage.setItem('currentUser', JSON.stringify({
          uid: userProfile.uid,
          email: userProfile.email,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          fullName: userProfile.fullName,
          role: userProfile.role
        }));

        this.presentToast('Login successful!', 'success', 2500, 'checkmark-circle-outline');

        const top = await this.loadingController.getTop();
          if (top) await top.dismiss();


        if (userProfile.role === 'admin') {
            this.navCtrl.navigateRoot('/admin-dashboard');
            return;
          }

        if (userProfile.role === 'user') {
          const hasCompletedOnboarding =
            await this.medicalService.hasCompletedAllergyOnboarding(userProfile.uid);

          if (!hasCompletedOnboarding) {
            this.navCtrl.navigateRoot('/allergy-onboarding');
            return;
          }

          this.navCtrl.navigateRoot('/tabs/home');
          return;
        }

        if (userProfile.role === 'doctor') {
          this.navCtrl.navigateRoot('/tabs/doctor-dashboard');
          return;
        }
        this.navCtrl.navigateRoot('/login');
      }
      

    } catch (error: any) {
      console.error('Login error:', error);

      if (error.code === 'auth/email-not-verified') {
        await this.presentErrorAlert(
          'Email Not Verified',
          'Please verify your email address before logging in. Would you like us to resend the verification email?',
          [
            { text: 'Cancel', role: 'cancel' },
            { text: 'Resend', handler: async () => { await this.resendVerificationEmail(); } }
          ]
        );
      } else {
        const { message, color, icon, duration } = this.getErrorToastConfig(error);
        this.presentToast(message, color, duration, icon);
      }

    } finally {
      const top = await this.loadingController.getTop();
      if (top) {
        await top.dismiss();
      }
    }
  }

  async openForgotPasswordModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: ForgotPasswordModal,
      cssClass: 'forgot-password-modal'
    });
    await modal.present();
  }

  async presentToast(message: string, color: string = 'medium', duration: number = 3000, icon?: string) {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      color,
      icon
    });
    await toast.present();
  }

  private getErrorToastConfig(error: any): { message: string; color: string; icon?: string; duration: number } {
    const code = error?.code as string | undefined;
    switch (code) {
      case 'auth/user-not-found':
        return { message: 'No account found with this email.', color: 'warning', icon: 'person-circle-outline', duration: 3500 };
      case 'auth/wrong-password':
        return { message: 'Incorrect password. Please try again.', color: 'danger', icon: 'key-outline', duration: 3500 };
      case 'auth/invalid-email':
        return { message: 'Invalid email format.', color: 'warning', icon: 'mail-outline', duration: 3000 };
      case 'auth/too-many-requests':
        return { message: 'Too many attempts. Try again later.', color: 'medium', icon: 'time-outline', duration: 4000 };
      case 'auth/network-request-failed':
        return { message: 'Network error. Check your connection.', color: 'warning', icon: 'wifi-outline', duration: 3500 };
      default:
        return { message: 'Unable to sign in. Please try again.', color: 'medium', icon: 'alert-circle-outline', duration: 3500 };
    }
  }

  async presentErrorAlert(header: string, message: string, buttons: any[] = ['OK']) {
    const alert = await this.alertController.create({ header, message, buttons });
    await alert.present();
  }

  private async resendVerificationEmail() {
    try {
      const maybeMethod: any = (this.authService as any);
      if (typeof maybeMethod.resendVerificationEmail === 'function') {
        await maybeMethod.resendVerificationEmail(this.email);
      } else if (typeof maybeMethod.sendEmailVerification === 'function') {
        await maybeMethod.sendEmailVerification(this.email);
      }
      await this.presentToast('Verification email sent. Please check your inbox.');
    } catch (e: any) {
      await this.presentToast(`Failed to send verification email: ${e?.message || 'Unknown error'}`);
    }
  }
}