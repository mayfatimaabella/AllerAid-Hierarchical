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
    private http: HttpClient,
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

      const buddyRelations =
        await this.buddyService.getUserBuddies(emergencyAlert.userId);

      if (buddyRelations.length === 0) {
        console.log('No buddies found to notify');
        return;
      }

      // Gracefully handle missing userProfile
      const notificationData =
        this.prepareNotificationData(emergencyAlert, userProfile || {});

      const notificationPromises = buddyRelations.map(async (buddy) => {
        try {
          const buddyId = buddy.id || buddy.buddyId;
          if (!buddyId) {
            console.warn('Buddy without ID found, skipping');
            return;
          }
          await this.sendToBuddy(buddy, notificationData);
          this.updateNotificationStatus(buddyId, 'sent');
        } catch (error) {
          const buddyId = buddy.id || buddy.buddyId || 'unknown';
          console.error(`Failed to notify buddy ${buddyId}:`, error);
          this.updateNotificationStatus(buddyId, 'failed');
        }
      });

      await Promise.all(notificationPromises);

      console.log('Emergency notifications process completed');

    } catch (error) {
      console.error('Emergency notification process failed:', error);
      // Don't throw - notifications failing shouldn't block the emergency alert
    }
  }

  private prepareNotificationData(
  emergencyAlert: EmergencyAlert,
  userProfile: any
): EmergencyNotificationData {
  // Safely extract data with fallbacks
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
      : (medicalInfo.allergies || []).map((allergy: any) =>
          typeof allergy === 'string' ? allergy : (allergy.label || allergy.name || allergy)
        ).filter((a: any) => !!a);

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
      latitude: hasLocation
        ? emergencyAlert.location!.latitude
        : 0,

      longitude: hasLocation
        ? emergencyAlert.location!.longitude
        : 0,

      locationLink: hasLocation
        ? locationLink
        : 'Location unavailable'
    },

    emergencyId: emergencyAlert.id!,
    timestamp: new Date().toISOString()
  };
}

  private async sendToBuddy(
    buddy: any,
    notificationData: EmergencyNotificationData
  ): Promise<void> {
    try {
      const buddyId = buddy.id || buddy.buddyId;
      if (!buddyId) {
        console.warn('Buddy ID not found, skipping notification');
        return;
      }

      this.updateNotificationStatus(buddyId, 'sending');

      const buddyUserId = buddy.connectedUserId || buddy.user2Id || buddy.user1Id || buddy.buddyUid;
      if (!buddyUserId) {
        console.warn(`No user ID found for buddy ${buddyId}`);
        this.updateNotificationStatus(buddyId, 'failed');
        return;
      }

      const buddyProfile = await this.userService.getUserProfile(buddyUserId);

      if (!buddyProfile) {
        console.warn(`Buddy profile not found for ${buddyId} (userId: ${buddyUserId})`);
        this.updateNotificationStatus(buddyId, 'failed');
        return;
      }

      await this.sendPushNotification(buddyProfile, notificationData);
      console.log(`Notifications sent to buddy: ${buddyProfile.fullName}`);
    } catch (error) {
      console.error('Error sending notification to buddy:', error);
      throw error;
    }
  }

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

          contactNumber: notificationData.profileDetails.phone,
          dateOfBirth: notificationData.profileDetails.dateOfBirth,
          bloodType: notificationData.profileDetails.bloodType,
          gender: notificationData.profileDetails.gender,
          profilePicture: notificationData.profileDetails.profile_picture,

          profileDetails: notificationData.profileDetails,

          location: notificationData.location,
          allergies: notificationData.allergies,
          instructions: notificationData.emergencyInstructions
        },

        click_action:
          `https://your-app-domain.com/tabs/responder-dashboard?emergency=${notificationData.emergencyId}`
      };

      const endpoint = environment.pushNotificationEndpoint;

      if (endpoint) {
        await firstValueFrom(
          this.http.post(endpoint, {
            targetUserId: buddyProfile.uid || buddyProfile.id,
            message: pushMessage
          })
        );
      } else {
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