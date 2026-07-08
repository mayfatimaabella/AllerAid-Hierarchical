import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';

import { EmergencyAlert } from './emergency.service';
import { BuddyService } from './buddy.service';
import { UserService } from './user.service';
import { environment } from '../../../environments/environment';

export interface EmergencyNotificationData {
  patientName: string;
  allergies: string[];
  emergencyInstructions: string;

  profileDetails: {
    phone: string;
    dateOfBirth: string;
    bloodType: string;
    gender: string;
    profile_picture: string;
  };

  location?: {
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
  private notificationStatusSubject =
    new BehaviorSubject<{ [key: string]: 'sending' | 'sent' | 'failed' }>({});

  notificationStatus$ = this.notificationStatusSubject.asObservable();

  constructor(
    private buddyService: BuddyService,
    private userService: UserService
  ) {}

  async sendEmergencyNotifications(
    emergencyAlert: EmergencyAlert,
    userProfile: any
  ): Promise<void> {
    try {
      console.log('Starting emergency notification process...');

      if (!emergencyAlert?.userId) {
        console.error('Emergency alert missing userId');
        return;
      }

      const patientUserId = emergencyAlert.userId;

      const buddyRelations = await this.buddyService.getUserBuddies(patientUserId);

      console.log('Buddy relations found:', buddyRelations);

      if (!buddyRelations || buddyRelations.length === 0) {
        console.log('No buddies found to notify');
        return;
      }

      const notificationData = this.prepareNotificationData(
        emergencyAlert,
        userProfile || {}
      );

      const notificationPromises = buddyRelations.map(async (buddy) => {
        const buddyStatusKey =
          buddy.buddyUid ||
          buddy.buddyId ||
          buddy.connectedUserId ||
          buddy.uid ||
          buddy.id ||
          buddy.user2Id ||
          buddy.user1Id;

        if (!buddyStatusKey) {
          console.warn('Buddy without ID found, skipping:', buddy);
          return;
        }

        try {
          await this.sendToBuddy(
            buddy,
            notificationData,
            buddyStatusKey,
            patientUserId
          );

          this.updateNotificationStatus(buddyStatusKey, 'sent');
        } catch (error) {
          console.error(`Failed to notify buddy ${buddyStatusKey}:`, error);
          this.updateNotificationStatus(buddyStatusKey, 'failed');
        }
      });

      await Promise.all(notificationPromises);

      console.log('Emergency notifications process completed');

    } catch (error) {
      console.error('Emergency notification process failed:', error);
    }
  }

  private prepareNotificationData(
    emergencyAlert: EmergencyAlert,
    userProfile: any
  ): EmergencyNotificationData {
    const baseProfile = userProfile || {};
    const profileDetails = baseProfile.profileDetails || {};
    const medicalInfo = baseProfile.medicalInfo || {};

    const hasLocation =
      emergencyAlert.location &&
      typeof emergencyAlert.location.latitude === 'number' &&
      typeof emergencyAlert.location.longitude === 'number';

    const locationLink = hasLocation
      ? this.generateLocationLink(
          emergencyAlert.location!.latitude,
          emergencyAlert.location!.longitude
        )
      : '';

    const allergies =
      emergencyAlert.allergies?.length
        ? emergencyAlert.allergies
        : (medicalInfo.allergies || [])
            .map((allergy: any) =>
              typeof allergy === 'string'
                ? allergy
                : allergy.label || allergy.name || allergy.value || allergy
            )
            .filter((allergy: any) => !!allergy);

    return {
      patientName:
        emergencyAlert.userName ||
        baseProfile.fullName ||
        `${baseProfile.firstName || ''} ${baseProfile.lastName || ''}`.trim() ||
        'Patient',

      allergies,

      emergencyInstructions:
        emergencyAlert.instruction ||
        emergencyAlert.emergencyInstruction ||
        medicalInfo.generalEmergencyInstruction ||
        medicalInfo.emergencyInstruction ||
        medicalInfo.generalInstruction ||
        'No specific instructions provided',

      profileDetails: {
        phone: profileDetails.phone || '',
        dateOfBirth: profileDetails.dateOfBirth || '',
        bloodType: profileDetails.bloodType || '',
        gender: profileDetails.gender || '',
        profile_picture: profileDetails.profile_picture || ''
      },

      location: {
        latitude: hasLocation ? emergencyAlert.location!.latitude : 0,
        longitude: hasLocation ? emergencyAlert.location!.longitude : 0,
        locationLink: hasLocation ? locationLink : 'Location unavailable'
      },

      emergencyId: emergencyAlert.id || '',
      timestamp: new Date().toISOString()
    };
  }

  private async sendToBuddy(
    buddy: any,
    notificationData: EmergencyNotificationData,
    buddyStatusKey: string,
    patientUserId: string
  ): Promise<void> {
    try {
      this.updateNotificationStatus(buddyStatusKey, 'sending');

      let buddyUserId =
        buddy.buddyUid ||
        buddy.buddyId ||
        buddy.connectedUserId ||
        buddy.uid ||
        buddy.id;

      if (!buddyUserId && buddy.user1Id && buddy.user2Id) {
        buddyUserId =
          buddy.user1Id === patientUserId
            ? buddy.user2Id
            : buddy.user1Id;
      }

      if (buddyUserId === patientUserId && buddy.user1Id && buddy.user2Id) {
        buddyUserId =
          buddy.user1Id === patientUserId
            ? buddy.user2Id
            : buddy.user1Id;
      }

      console.log('Resolved buddy user ID:', {
        patientUserId,
        buddyUserId,
        buddy
      });

      if (!buddyUserId) {
        console.warn(`No user ID found for buddy ${buddyStatusKey}`);
        this.updateNotificationStatus(buddyStatusKey, 'failed');
        return;
      }

      const buddyProfile = await this.userService.getUserProfile(buddyUserId);

      if (!buddyProfile) {
        console.warn(
          `Buddy profile not found for ${buddyStatusKey} userId: ${buddyUserId}`
        );
        this.updateNotificationStatus(buddyStatusKey, 'failed');
        return;
      }

      await this.sendPushNotification(
        buddyUserId,
        buddyProfile,
        notificationData
      );

      console.log(
        `Notification sent to buddy: ${
          buddyProfile.fullName || buddyProfile.email || buddyUserId
        }`
      );

    } catch (error) {
      console.error('Error sending notification to buddy:', error);
      throw error;
    }
  }

  private async sendPushNotification(
    targetUserId: string,
    buddyProfile: any,
    notificationData: EmergencyNotificationData
  ): Promise<void> {
    try {
      const pushMessage = {
        title: 'EMERGENCY ALERT',
        body: `${notificationData.patientName} needs immediate help!`,

        data: {
          type: 'emergency',
          emergencyId: String(notificationData.emergencyId || ''),
          patientName: String(notificationData.patientName || ''),

          contactNumber: String(notificationData.profileDetails.phone || ''),
          dateOfBirth: String(notificationData.profileDetails.dateOfBirth || ''),
          bloodType: String(notificationData.profileDetails.bloodType || ''),
          gender: String(notificationData.profileDetails.gender || ''),
          profilePicture: String(notificationData.profileDetails.profile_picture || ''),

          profileDetails: JSON.stringify(notificationData.profileDetails || {}),
          location: JSON.stringify(notificationData.location || {}),
          allergies: JSON.stringify(notificationData.allergies || []),
          instructions: String(notificationData.emergencyInstructions || '')
        }
      };

      const endpoint = environment.pushNotificationEndpoint;

      console.log('Push endpoint:', endpoint);
      console.log('Sending push to target user:', targetUserId);
      console.log('Push message:', pushMessage);

      if (!targetUserId) {
        throw new Error('Missing targetUserId');
      }

      if (!endpoint) {
        console.log('Push Notification simulated only because endpoint is missing.');
        console.log(
          `To: ${buddyProfile.fullName || buddyProfile.email || targetUserId}`
        );
        console.log('Message:', pushMessage);
        return;
      }

      const response = await CapacitorHttp.post({
        url: endpoint,
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          targetUserId,
          message: pushMessage
        }
      });

      console.log('Push notification backend response:', response.data);

      if (!response.data?.success || Number(response.data?.sent || 0) <= 0) {
        throw new Error(
          `Push backend did not send notification. Sent: ${
            response.data?.sent || 0
          }, Failed: ${response.data?.failed || 0}`
        );
      }

    } catch (error) {
      console.error('Push notification failed:', error);
      throw error;
    }
  }

  private generateLocationLink(latitude: number, longitude: number): string {
    return `https://www.google.com/maps?q=${latitude},${longitude}&ll=${latitude},${longitude}&z=16`;
  }

  private updateNotificationStatus(
    buddyId: string,
    status: 'sending' | 'sent' | 'failed'
  ): void {
    const currentStatus = this.notificationStatusSubject.value;

    this.notificationStatusSubject.next({
      ...currentStatus,
      [buddyId]: status
    });
  }

  clearNotificationStatus(): void {
    this.notificationStatusSubject.next({});
  }
}