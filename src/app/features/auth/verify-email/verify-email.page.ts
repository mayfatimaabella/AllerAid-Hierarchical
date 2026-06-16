import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

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

  role: 'user' | 'doctor' = 'user';

  resendDisabled = false;
  resendCountdown = 0;
  resendInterval: any;

  private pollInterval: any;
  private readonly POLL_INTERVAL_MS = 4000;

  constructor(
    private authService: AuthService,
    private toastController: ToastController,
    private navCtrl: NavController,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.email = this.authService.getCurrentUserEmail();

    const roleParam = this.route.snapshot.queryParamMap.get('role');
    this.role = roleParam === 'doctor' ? 'doctor' : 'user';

    this.startVerificationPolling();
  }

  ngOnDestroy() {
    this.stopVerificationPolling();

    if (this.resendInterval) {
      clearInterval(this.resendInterval);
    }
  }

  get isDoctor(): boolean {
    return this.role === 'doctor';
  }

  private startVerificationPolling(): void {
    this.pollInterval = setInterval(async () => {
      try {
        const user = this.authService.getCurrentUser();

        if (user) {
          await user.reload();
        }

        if (user?.emailVerified) {
          this.stopVerificationPolling();

          if (this.isDoctor) {
            await this.presentToast(
              'Email verified! Your doctor account is pending admin approval.',
              'success'
            );
          } else {
            await this.presentToast(
              'Email verified! You may now log in.',
              'success'
            );
          }

          this.navCtrl.navigateRoot('/login');
        }
      } catch (error) {
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

      await this.presentToast(
        'Verification email resent. Please check your inbox or spam folder.',
        'success'
      );

      this.startResendCooldown(60);
    } catch (error: any) {
      console.error('Error resending verification email:', error);

      if (error.code === 'auth/too-many-requests') {
        await this.presentToast(
          'Too many requests. Please wait and try again later.',
          'warning'
        );
      } else {
        await this.presentToast(
          'Failed to resend verification email.',
          'danger'
        );
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