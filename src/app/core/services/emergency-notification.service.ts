import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { EmergencyAlert } from './emergency.service';
import { BuddyService } from './buddy.service';
import { UserService } from './user.service';
import { environment } from '../../../environments/environment';

export interface EmergencyNotificationData {
  patientName: string;
  allergies: string[];
  emergencyInstructions: string;
  location: {
    latitude: number;
    longitude: number;
    locationLink: string;
  };
  emergencyId: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyNotificationService {
  private notificationStatusSubject = new BehaviorSubject<{[key: string]: 'sending' | 'sent' | 'failed'}>({});
  notificationStatus$ = this.notificationStatusSubject.asObservable();

  constructor(
    private http: HttpClient,
    private buddyService: BuddyService,
    private userService: UserService
  ) {}

  /**
   * Send emergency notifications to all buddies
   */
  async sendEmergencyNotifications(
    emergencyAlert: EmergencyAlert,
    userProfile: any
  ): Promise<void> {
    try {
      console.log('Starting emergency notification process...');
      
      // Get all buddies for this user (who should receive notifications)
      const buddyRelations = await this.buddyService.getUserBuddies(emergencyAlert.userId);
      
      if (buddyRelations.length === 0) {
        console.log('No buddies found to notify');
        return;
      }

      // Prepare notification data
      const notificationData = this.prepareNotificationData(emergencyAlert, userProfile);
      
      // Send notifications to each buddy
      const notificationPromises = buddyRelations.map(async (buddy) => {
        try {
          await this.sendToBuddy(buddy, notificationData);
          this.updateNotificationStatus(buddy.id!, 'sent');
        } catch (error) {
          console.error(`Failed to notify buddy ${buddy.id}:`, error);
          this.updateNotificationStatus(buddy.id!, 'failed');
        }
      });

      // Wait for all notifications to complete
      await Promise.all(notificationPromises);
      
      console.log('Emergency notifications process completed');
      
    } catch (error) {
      console.error('Emergency notification process failed:', error);
      throw error;
    }
  }

  /**
   * Prepare comprehensive notification data
   */
  private prepareNotificationData(
    emergencyAlert: EmergencyAlert,
    userProfile: any
  ): EmergencyNotificationData {
    const locationLink = this.generateLocationLink(
      emergencyAlert.location.latitude,
      emergencyAlert.location.longitude
    );

    return {
      patientName: emergencyAlert.userName,
      allergies: emergencyAlert.allergies || [],
      emergencyInstructions: emergencyAlert.instruction || userProfile.emergencyInstruction || 'No specific instructions provided',
      location: {
        latitude: emergencyAlert.location.latitude,
        longitude: emergencyAlert.location.longitude,
        locationLink
      },
      emergencyId: emergencyAlert.id!,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Send notification to a specific buddy
   */
  private async sendToBuddy(
    buddy: any,
    notificationData: EmergencyNotificationData
  ): Promise<void> {
    this.updateNotificationStatus(buddy.id!, 'sending');

    // Get buddy's user profile for contact information
    // Use connectedUserId which contains the actual buddy's user ID
    const buddyUserId = buddy.connectedUserId || buddy.user2Id;
    const buddyProfile = await this.userService.getUserProfile(buddyUserId);
    
    if (!buddyProfile) {
      throw new Error(`Buddy profile not found for ${buddy.id} (userId: ${buddyUserId})`);
    }

    // Send push notification (if supported)
    await this.sendPushNotification(buddyProfile, notificationData);

    console.log(`Notifications sent to buddy: ${buddyProfile.fullName}`);
  }


  /**
   * Send push notification
   */
  private async sendPushNotification(
    buddyProfile: any,
    notificationData: EmergencyNotificationData
  ): Promise<void> {
    try {
      const pushMessage = {
        title: 'EMERGENCY ALERT',
        body: `${notificationData.patientName} needs immediate help!`,
        data: {
          type: 'emergency',
          emergencyId: notificationData.emergencyId,
          patientName: notificationData.patientName,
          location: notificationData.location,
          allergies: notificationData.allergies,
          instructions: notificationData.emergencyInstructions
        },
        click_action: `https://your-app-domain.com/tabs/responder-dashboard?emergency=${notificationData.emergencyId}`
      };

      const endpoint = environment.pushNotificationEndpoint;

      if (endpoint) {
        // Real backend call: send the push payload to your Cloud Function / API
        await firstValueFrom(
          this.http.post(endpoint, {
            targetUserId: buddyProfile.uid || buddyProfile.id,
            message: pushMessage
          })
        );
      } else {
        // Fallback / development mode: log instead of sending
        console.log('Push Notification (simulated):');
        console.log(`To: ${buddyProfile.fullName}`);
        console.log('Message:', pushMessage);
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error('Push notification failed:', error);
      throw error;
    }
  }

  /**
   * Generate live location link for navigation
   */
  private generateLocationLink(latitude: number, longitude: number): string {
    return `https://www.google.com/maps?q=${latitude},${longitude}&ll=${latitude},${longitude}&z=16`;
  }

  /**
   * Update notification status for UI feedback
   */
  private updateNotificationStatus(buddyId: string, status: 'sending' | 'sent' | 'failed'): void {
    const currentStatus = this.notificationStatusSubject.value;
    this.notificationStatusSubject.next({
      ...currentStatus,
      [buddyId]: status
    });
  }


  /**
   * Clear notification status (call after emergency is resolved)
   */
  clearNotificationStatus(): void {
    this.notificationStatusSubject.next({});
  }

}
