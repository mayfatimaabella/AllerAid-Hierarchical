import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from 'src/app/core/services/auth.service';
import { ToastController, NavController } from '@ionic/angular';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class VerifyEmailPage {
  email: string | null = null;
  now = new Date();
  resendDisabled = false;
  resendCountdown = 0;
  resendInterval: any;

  constructor(
    private authService: AuthService,
    private toastController: ToastController,
    private navCtrl: NavController
  ) {}
  goToRegistration() {
    this.navCtrl.navigateBack('/registration');
  }

  goToLogin() {
    this.navCtrl.navigateBack('/login');
  }

  ngOnInit() {
    this.email = this.authService.getCurrentUserEmail();
    this.checkEmailVerification(); // Check email verification status
  }

  async checkEmailVerification() {
    try {
      const user = await this.authService.getCurrentUser();
      if (user && user.emailVerified) {
        console.log('Email verified:', user.emailVerified);
        this.presentToast('Your email has been verified successfully!');
        this.navCtrl.navigateRoot('/dashboard'); // Redirect to dashboard or next page
      } else if (user) {
        console.log('Email not verified:', user.emailVerified);
        this.presentToast('Your email is not verified yet. Please check your inbox and click the verification link.');
      } else {
        console.error('No user found while checking email verification.');
        this.presentToast('No user is currently logged in. Please log in and try again.');
      }
    } catch (error) {
      console.error('Error checking email verification:', error);
      this.presentToast('An error occurred while verifying your email. Please try again.');
    }
  }

  async resendVerificationEmail() {
    if (this.resendDisabled) {
      console.log('Resend disabled due to cooldown.');
      return;
    }
    try {
      console.log('Resending verification email...');
      await this.authService.resendVerificationEmail();
      this.presentToast('Verification email resent. Please check your inbox.');
      this.startResendCooldown(60); // 60 seconds cooldown
    } catch (error: any) {
      console.error('Error resending verification email:', error);
      if (error.code === 'auth/too-many-requests') {
        this.presentToast('Too many requests. Please wait and try again later.');
      } else {
        this.presentToast('Failed to resend verification email.');
      }
    }
  }

  startResendCooldown(seconds: number) {
    this.resendDisabled = true;
    this.resendCountdown = seconds;
    this.resendInterval = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        this.resendDisabled = false;
        clearInterval(this.resendInterval);
        console.log('Cooldown ended. Resend enabled.');
      }
    }, 1000);
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'medium',
    });
    toast.present();
  }
}
