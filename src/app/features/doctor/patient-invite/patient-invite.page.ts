import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-patient-invite',
  templateUrl: './patient-invite.page.html',
  styleUrls: ['./patient-invite.page.scss'],
  standalone: false,
})
export class PatientInvitePage implements OnInit, OnDestroy {
  inviteForm!: FormGroup;
  isSubmitting: boolean = false;
  showSuccessMessage: boolean = false;
  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeForm() {
    this.inviteForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phoneNumber: ['', [Validators.pattern(/^[0-9\-+()\s]*$/)]],
      message: ['', [Validators.maxLength(500)]]
    });
  }

  async sendInvite() {
    if (!this.inviteForm.valid) {
      this.showToast('Please fill in all required fields correctly', 'warning');
      return;
    }

    this.isSubmitting = true;
    const inviteData = this.inviteForm.value;

    try {
      // TODO: Implement invite sending through service
      // await this.patientService.sendInvite(inviteData).toPromise();
      
      this.showSuccessMessage = true;
      this.showToast('Invitation sent successfully!', 'success');
      
      setTimeout(() => {
        this.router.navigate(['/doctor-dashboard']);
      }, 2000);
      
    } catch (error) {
      console.error('Error sending invite:', error);
      this.showToast('Failed to send invitation', 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }

  async sendBulkInvites() {
    const alert = await this.alertController.create({
      header: 'Bulk Invite',
      message: 'Paste email addresses separated by commas or new lines',
      inputs: [
        {
          name: 'emails',
          type: 'textarea',
          placeholder: 'email1@example.com, email2@example.com'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Send',
          handler: async (data) => {
            // TODO: Implement bulk invite
            this.showToast('Bulk invites feature coming soon', 'info');
          }
        }
      ]
    });
    await alert.present();
  }

  filterPhoneInput(event: any) {
    const input = event.target.value;
    // Remove any characters that are not digits, +, -, (, ), or spaces
    const filtered = input.replace(/[^0-9+\-() ]/g, '');
    this.inviteForm.get('phoneNumber')?.setValue(filtered, { emitEvent: false });
  }

  resetForm() {
    this.inviteForm.reset();
    this.showSuccessMessage = false;
  }

  async showToast(message: string, color: string = 'default') {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2000,
      position: 'top',
    });
    await toast.present();
  }
}
