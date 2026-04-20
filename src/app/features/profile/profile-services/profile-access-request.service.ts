import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { EHRService, AccessRequest } from '../../../core/services/ehr.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileAccessRequestService {
  pendingRequests: any[] = [];

  constructor(
    private ehrService: EHRService,
    private alertController: AlertController
  ) {}

  /**
   * Load pending access requests
   */
  async loadAccessRequests(): Promise<void> {
    try {
      this.pendingRequests = await this.ehrService.getPendingAccessRequests();
    } catch (error) {
      console.error('Error loading access requests:', error);
    }
  }

  /**
   * Accept an access request
   */
  async acceptAccessRequest(requestOrEvent: any, onRefresh: () => Promise<void>): Promise<void> {
    const request: AccessRequest = requestOrEvent?.request || requestOrEvent;
    const alert = await this.alertController.create({
      header: 'Accept Access Request',
      message: `Accept access to ${request.patientName}'s medical records?`,
      inputs: [{ name: 'notes', type: 'textarea', placeholder: 'Optional notes...' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Accept',
          handler: async (data) => {
            try {
              await this.ehrService.respondToAccessRequest(request.id!, 'accepted', data.notes);
              await onRefresh();
            } catch (error) {
              console.error('Error accepting request:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Decline an access request
   */
  async declineAccessRequest(requestOrEvent: any, onRefresh: () => Promise<void>): Promise<void> {
    const request: AccessRequest = requestOrEvent?.request || requestOrEvent;
    const alert = await this.alertController.create({
      header: 'Decline Access Request',
      message: `Decline access request from ${request.patientName}?`,
      inputs: [{ name: 'notes', type: 'textarea', placeholder: 'Optional reason...' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Decline',
          handler: async (data) => {
            try {
              await this.ehrService.respondToAccessRequest(request.id!, 'declined', data.notes);
              await onRefresh();
            } catch (error) {
              console.error('Error declining request:', error);
            }
          }
        }
      ]
    });
    await alert.present();
  }
}

