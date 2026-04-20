import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password-modal',
  templateUrl: './forgot-password.modal.html',
  styleUrls: ['./forgot-password.modal.scss'],
  standalone: false,
})
export class ForgotPasswordModal implements OnInit {
  email: string = '';
  isLoading: boolean = false;
  emailSent: boolean = false;

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private authService: AuthService
  ) {}

  ngOnInit(): void {}

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(): Promise<void> {
    // Validate email
    if (!this.email || !this.email.trim()) {
      this.presentToast('Please enter your email address', 'warning');
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.presentToast('Please enter a valid email address', 'warning');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Sending password reset email...',
      spinner: 'circular',
    });
    await loading.present();

    try {
      await this.authService.sendPasswordReset(this.email);
      this.emailSent = true;
      this.presentToast('Password reset email sent! Check your inbox.', 'success');
      
      // Close the modal after 2 seconds
      setTimeout(() => {
        this.dismiss();
      }, 2000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      this.handlePasswordResetError(error);
    } finally {
      this.isLoading = false;
      await loading.dismiss();
    }
  }

  /**
   * Handle specific error cases
   */
  private handlePasswordResetError(error: any): void {
    let message = 'Failed to send password reset email. Please try again.';

    if (error.code === 'auth/user-not-found') {
      message = 'No account found with this email address.';
    } else if (error.code === 'auth/invalid-email') {
      message = 'Invalid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      message = 'Too many attempts. Please try again later.';
    } else if (error.message) {
      message = error.message;
    }

    this.presentToast(message, 'danger');
  }

  /**
   * Present a toast notification
   */
  private async presentToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }

  /**
   * Cancel and close the modal
   */
  cancel(): void {
    this.dismiss();
  }

  /**
   * Dismiss the modal
   */
  dismiss(): void {
    this.modalController.dismiss();
  }
}
