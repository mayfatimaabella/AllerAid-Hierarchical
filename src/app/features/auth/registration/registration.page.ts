import { Component, ViewChild, ElementRef } from '@angular/core';
import { ToastController, NavController, LoadingController } from '@ionic/angular';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { StorageService } from '../../../core/services/storage.service';

@Component({
  selector: 'app-registration',
  templateUrl: './registration.page.html',
  styleUrls: ['./registration.page.scss'],
  standalone: false,
})
export class RegistrationPage {
  firstName = '';
  lastName = '';
  email = '';
  password = '';
  confirmPassword = '';
  role = '';
  selectedFile: File | null = null;
  selectedFileName = '';
  licenseURL = '';
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;

  // Password policy: at least 8 characters, 1 uppercase, 1 number, 1 special character
  minPasswordLength = 8;

  isPasswordStrong(password: string): boolean {
    if (!password) return false;
    const lengthOk = password.length >= this.minPasswordLength;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    return lengthOk && hasUpper && hasNumber && hasSpecial;
  }

  // Useful for template binding
  get isPasswordValid(): boolean {
    return this.isPasswordStrong(this.password);
  }

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private toastController: ToastController,
    private navCtrl: NavController,
    private userService: UserService,
    private authService: AuthService,
    private storageService: StorageService,
    private loadingController: LoadingController
  ) {}

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.selectedFileName = file.name;
      console.log('Selected license file:', this.selectedFileName);
      this.presentToast(`Selected file: ${this.selectedFileName}`);
    }
  }

  async register() {
    if (!this.email || !this.password || !this.confirmPassword || !this.firstName || !this.lastName || !this.role) {
      this.presentToast('All fields are required.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.presentToast('Passwords do not match.');
      return;
    }

    if (!this.isPasswordStrong(this.password)) {
      this.presentToast('Password must be at least 8 characters long and include at least one uppercase letter, one number, and one special character.');
      return;
    }

    if (this.role === 'doctor' && !this.selectedFile) {
      this.presentToast('Please upload your medical license.');
      return;
    }

    try {
      const loading = await this.loadingController.create({
        message: 'Creating your account...',
        spinner: 'crescent'
      });
      await loading.present();

      //  Create user in Firebase Auth
      const userCredential = await this.authService.signUp(this.email, this.password);


      if (userCredential.user) {
        const uid = userCredential.user.uid;
        console.log('User created in Firebase Auth:', uid);


        // Upload license photo for doctors
        if (this.role === 'doctor' && this.selectedFile) {
          try {
            this.licenseURL = await this.storageService.uploadLicense(this.selectedFile, uid);
            this.presentToast('License uploaded successfully.', 'success', 2500);
          } catch (uploadErr) {
            console.error('License upload failed:', uploadErr);
            this.presentToast('License upload failed. Please try again.');
            this.licenseURL = '';
          }
        }


        // Create Firestore profile — only include licenseURL when it's a non-empty string
        const profileData: any = {
          email: this.email,
          firstName: this.firstName,
          lastName: this.lastName,
          role: this.role,
        };

        if (this.licenseURL && this.licenseURL.length > 0) {
          profileData.licenseURL = this.licenseURL;
        }

        await this.userService.createUserProfile(uid, profileData);

        let verificationEmailSent = true;
        try {
          await this.authService.sendVerificationEmail(userCredential.user);
        } catch (verifyError) {
          console.error('Failed to send verification email during registration:', verifyError);
          verificationEmailSent = false;
        }

        // Navigate to verify-email page
        if (verificationEmailSent) {
          this.presentToast('Registration successful! Check your email to verify your account.', 'success', 3000);
        } else {
          this.presentToast('Account created. Verification email could not be sent yet. Please use Resend on the next page.', 'warning', 3500);
        }
        this.navCtrl.navigateForward('/verify-email');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        this.presentToast('This email address is already registered. Please log in or use a different email.');
      } else if (error.code === 'auth/configuration-not-found') {
        this.presentToast('Firebase Auth is not configured for this project. Enable Authentication and Email/Password sign-in in Firebase Console.');
      } else {
        this.presentToast(`Registration failed: ${error.message}`);
      }
    } finally {
      const top = await this.loadingController.getTop();
      if (top) {
        await top.dismiss();
      }
    }
  }

  async presentToast(message: string, color: string = 'medium', duration: number = 3000, icon?: string) {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      color,
      icon
    });
    toast.present();
  }
}
