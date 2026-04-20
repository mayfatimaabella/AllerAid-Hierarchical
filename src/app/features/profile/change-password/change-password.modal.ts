import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-change-password-modal',
  templateUrl: './change-password.modal.html',
  styleUrls: ['./change-password.modal.scss'],
  standalone: false,
})
export class ChangePasswordModal implements OnInit {
  currentPassword: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  showCurrentPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private authService: AuthService
  ) {}

  ngOnInit(): void {}

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') {
      this.showCurrentPassword = !this.showCurrentPassword;
    } else if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
    } else if (field === 'confirm') {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  /**
   * Validate the form before submission
   */
  private validateForm(): boolean {
    // Check if all fields are filled
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.presentToast('All fields are required', 'warning');
      return false;
    }

    // Check if new password and confirm password match
    if (this.newPassword !== this.confirmPassword) {
      this.presentToast('New passwords do not match', 'danger');
      return false;
    }

    // Check if new password is at least 6 characters (Firebase minimum)
    if (this.newPassword.length < 6) {
      this.presentToast('Password must be at least 6 characters long', 'warning');
      return false;
    }

    // Check if new password is different from current password
    if (this.currentPassword === this.newPassword) {
      this.presentToast('New password must be different from current password', 'warning');
      return false;
    }

    return true;
  }

  /**
   * Change password
   */
  async changePassword(): Promise<void> {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Changing password...',
      spinner: 'circular',
    });
    await loading.present();

    try {
      await this.authService.changePassword(this.currentPassword, this.newPassword);
      this.presentToast('Password changed successfully', 'success');
      
      // Close the modal after successful password change
      setTimeout(() => {
        this.dismiss();
      }, 1500);
    } catch (error: any) {
      console.error('Password change error:', error);
      this.handlePasswordChangeError(error);
    } finally {
      this.isLoading = false;
      await loading.dismiss();
    }
  }

  /**
   * Handle specific error cases
   */
  private handlePasswordChangeError(error: any): void {
    let message = 'Failed to change password. Please try again.';

    if (error.code === 'auth/wrong-password') {
      message = 'Current password is incorrect. Please try again.';
    } else if (error.code === 'auth/requires-recent-login') {
      message = 'Your session has expired. Please log in again.';
    } else if (error.code === 'auth/weak-password') {
      message = 'Password is too weak. Please choose a stronger password.';
    } else if (error.message) {
      message = error.message;
    }

    this.presentToast(message, 'danger');
  }

  /**
   * Present a toast notification
   */
  private async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
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
