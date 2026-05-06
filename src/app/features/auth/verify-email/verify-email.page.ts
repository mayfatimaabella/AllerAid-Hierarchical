import { Component, OnInit, OnDestroy } from '@angular/core';
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
export class VerifyEmailPage implements OnInit, OnDestroy {
  email: string | null = null;
  resendDisabled = false;
  resendCountdown = 0;
  resendInterval: any;

  // Poll for verification so the user gets auto-redirected once they click the link
  private pollInterval: any;
  private readonly POLL_INTERVAL_MS = 4000;

  constructor(
    private authService: AuthService,
    private toastController: ToastController,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.email = this.authService.getCurrentUserEmail();
    // Don't check immediately — user just registered and the email is never
    // verified at this point. Start polling silently instead.
    this.startVerificationPolling();
  }

  ngOnDestroy() {
    this.stopVerificationPolling();
    if (this.resendInterval) {
      clearInterval(this.resendInterval);
    }
  }

  /**
   * Poll Firebase every few seconds. Once the user clicks the link in their
   * inbox and we detect verification, redirect them automatically.
   */
  private startVerificationPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        const user = await this.authService.getCurrentUser();
        // Force-reload the token so Firebase reflects the latest verified state
        if (user) {
          await user.reload();
        }
        if (user?.emailVerified) {
          this.stopVerificationPolling();
          await this.presentToast('Email verified! Redirecting…', 'success');
          this.navCtrl.navigateRoot('/login');
        }
      } catch (error) {
        // Silently ignore polling errors — user can still manually proceed
        console.error('Verification poll error:', error);
      }
    }, this.POLL_INTERVAL_MS);
  }

  private stopVerificationPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async resendVerificationEmail() {
    if (this.resendDisabled) return;
    try {
      await this.authService.resendVerificationEmail();
      await this.presentToast('Verification email resent. Please check your inbox.');
      this.startResendCooldown(60);
    } catch (error: any) {
      console.error('Error resending verification email:', error);
      if (error.code === 'auth/too-many-requests') {
        await this.presentToast('Too many requests. Please wait and try again later.');
      } else {
        await this.presentToast('Failed to resend verification email.');
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
      }
    }, 1000);
  }

  goToRegistration() {
    this.navCtrl.navigateBack('/registration');
  }

  goToLogin() {
    this.navCtrl.navigateBack('/login');
  }

  async presentToast(message: string, color: string = 'medium') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}