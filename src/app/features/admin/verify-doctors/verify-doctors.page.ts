import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';

import {
  AdminService,
  DoctorVerificationRequest
} from '../../../core/services/admin';

@Component({
  selector: 'app-verify-doctors',
  templateUrl: './verify-doctors.page.html',
  styleUrls: ['./verify-doctors.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class VerifyDoctorsPage implements OnInit {

  pendingDoctors: DoctorVerificationRequest[] = [];
  isLoading = false;

  constructor(
    private adminService: AdminService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadPendingDoctors();
  }

  async ionViewWillEnter() {
    await this.loadPendingDoctors();
  }

  async loadPendingDoctors() {
    try {
      this.isLoading = true;

      this.pendingDoctors =
        await this.adminService.getPendingDoctorVerificationRequests();

      console.log('Pending doctors:', this.pendingDoctors);

    } catch (error) {
      console.error('Load pending doctors error:', error);
      await this.presentToast('Failed to load pending doctors.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async approveDoctor(doctor: DoctorVerificationRequest) {
    const alert = await this.alertController.create({
      header: 'Approve Doctor?',
      message: `Approve ${doctor.fullName || doctor.email}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Approve',
          handler: async () => {
            try {
              await this.adminService.approveDoctor(doctor.uid);
              await this.presentToast('Doctor approved successfully.', 'success');
              await this.loadPendingDoctors();
            } catch (error) {
              console.error('Approve doctor error:', error);
              await this.presentToast('Failed to approve doctor.', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async rejectDoctor(doctor: DoctorVerificationRequest) {
    const alert = await this.alertController.create({
      header: 'Reject Doctor?',
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Reason for rejection'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reject',
          role: 'destructive',
          handler: async (data) => {
            try {
              await this.adminService.rejectDoctor(doctor.uid, data.reason);
              await this.presentToast('Doctor rejected.', 'warning');
              await this.loadPendingDoctors();
            } catch (error) {
              console.error('Reject doctor error:', error);
              await this.presentToast('Failed to reject doctor.', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async presentToast(message: string, color: string = 'medium') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });

    await toast.present();
  }
}