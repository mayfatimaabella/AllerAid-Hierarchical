import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';

import { AdminEmergencyService } from '../../../core/services/admin/admin-emergency';

@Component({
  selector: 'app-emergency-logs',
  templateUrl: './emergency-logs.page.html',
  styleUrls: ['./emergency-logs.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule
  ]
})
export class EmergencyLogsPage implements OnInit {

  emergencies: any[] = [];
  isLoading = false;

  constructor(
    private adminEmergencyService: AdminEmergencyService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadEmergencies();
  }

  async ionViewWillEnter() {
    await this.loadEmergencies();
  }

  async loadEmergencies() {

    try {

      this.isLoading = true;

      this.emergencies =
        await this.adminEmergencyService.getAllEmergencies();

      console.log('EMERGENCIES:', this.emergencies);

    } catch (error) {

      console.error('Load emergencies error:', error);

    } finally {

      this.isLoading = false;
    }
  }

async viewDetails(emergency: any) {

  const location =
    typeof emergency.location === 'object'
      ? `${emergency.location.lat || emergency.location.latitude || 'N/A'}, ${emergency.location.lng || emergency.location.longitude || 'N/A'}`
      : emergency.location || emergency.address || 'Unknown';

  const alert = await this.alertController.create({
    header: 'Emergency Details',

    message:
      `Patient: ${emergency.patientName || emergency.userName || emergency.name || 'Unknown'}\n\n` +
      `Status: ${emergency.status || 'active'}\n\n` +
      `Allergy: ${emergency.allergy || emergency.allergyName || 'Not specified'}\n\n` +
      `Message: ${emergency.message || emergency.emergencyMessage || 'No message'}\n\n` +
      `Location: ${location}\n\n` +
      `Contact: ${emergency.contactNumber || emergency.phone || 'Not provided'}`,

    buttons: ['Close']
  });

  await alert.present();
}
  async updateStatus(
    emergency: any,
    status: 'active' | 'responding' | 'resolved' | 'archived'
  ) {

    try {

      await this.adminEmergencyService.updateEmergencyStatus(
        emergency.id,
        status
      );

      await this.presentToast(
        `Emergency marked as ${status}.`,
        'success'
      );

      await this.loadEmergencies();

    } catch (error) {

      console.error('Update emergency status error:', error);

      await this.presentToast(
        'Failed to update emergency status.',
        'danger'
      );
    }
  }

  async presentToast(
    message: string,
    color: string = 'medium'
  ) {

    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });

    await toast.present();
  }
}