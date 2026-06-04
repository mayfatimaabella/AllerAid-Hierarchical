import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';

import { AdminEmergencyService } from '../../../core/services/admin/admin-emergency';
import { FirebaseService } from '../../../core/services/firebase.service';

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
export class EmergencyLogsPage {

  emergencies: any[] = [];
  filteredEmergencies: any[] = [];
  selectedFilter: string = 'all';
  isLoading = false;

  constructor(
    private adminEmergencyService: AdminEmergencyService,
    private firebase: FirebaseService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ionViewWillEnter() {
    await this.loadEmergencies();
  }

  async loadEmergencies() {
    try {
      this.isLoading = true;
      this.emergencies = await this.adminEmergencyService.getAllEmergencies();
      this.applyFilter(this.selectedFilter);
    } catch (error) {
      console.error('Load emergencies error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilter(filter: string) {
    this.selectedFilter = filter;
    if (filter === 'all') {
      this.filteredEmergencies = this.emergencies;
    } else {
      this.filteredEmergencies = this.emergencies.filter(e => e.status === filter);
    }
  }

  countByStatus(status: string): number {
    return this.emergencies.filter(e => e.status === status).length;
  }

  getAllergies(emergency: any): string {
    if (Array.isArray(emergency.allergies) && emergency.allergies.length > 0) {
      return emergency.allergies.join(', ');
    }
    return emergency.allergy || 'Not specified';
  }

  async viewDetails(emergency: any) {
    const location =
      typeof emergency.location === 'object'
        ? `${emergency.location.latitude ?? emergency.location.lat ?? 'N/A'}, ${emergency.location.longitude ?? emergency.location.lng ?? 'N/A'}`
        : emergency.location || emergency.address || 'Unknown';

    const alert = await this.alertController.create({
      header: 'Emergency Details',
      message:
        `Patient: ${emergency.patientName || emergency.userName || emergency.name || 'Unknown'}\n\n` +
        `Status: ${emergency.status || 'active'}\n\n` +
        `Allergies: ${this.getAllergies(emergency)}\n\n` +
        `Instruction: ${emergency.instruction || emergency.message || 'No message'}\n\n` +
        `Location: ${location}\n\n` +
        `Contact: ${emergency.contactNumber || emergency.phone || 'Not provided'}\n\n` +
        `Reported: ${emergency.createdAt?.toDate().toLocaleString() || 'Unknown'}`,
      buttons: ['Close']
    });

    await alert.present();
  }

  async updateStatus(
    emergency: any,
    status: 'active' | 'responding' | 'resolved' | 'archived'
  ) {
    const adminUid = this.firebase.getAuth().currentUser?.uid ?? 'unknown';

    try {
      await this.adminEmergencyService.updateEmergencyStatus(emergency.id, status, adminUid);
      await this.presentToast(`Emergency marked as ${status}.`, 'success');
      await this.loadEmergencies();
    } catch (error: any) {
      console.error('Update error:', error);
      await this.presentToast('Failed to update emergency status.', 'danger');
    }
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