import { Injectable } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { MedicalService, EmergencyMessage } from '../../../core/services/medical.service';
import { UserService, UserProfile } from '../../../core/services/user.service';
import { EditEmergencyProfileModalComponent } from '../overview/modals/edit-profile-message/edit-emergency-profile-modal.component';
import { EmergencyDetectorService } from '../../../core/services/emergency-detector.service';

interface EmergencyMessageFormData {
  name?: string;
  allergies?: string;
  instructions?: string;
  location?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dateOfBirth?: string;
  bloodType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileEmergencySettingsService {
  // State properties
  emergencySettings: any = {};
  showVoiceSettings: boolean = true;
  showEditEmergencyMessageModal: boolean = false;

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private medicalService: MedicalService,
    private userService: UserService,
    private emergencyDetectorService: EmergencyDetectorService
  ) {}

  private parseName(name?: string): { firstName?: string; lastName?: string; fullName?: string } {
    const raw = (name || '').trim();
    if (!raw) {
      return {};
    }

    const parts = raw.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    return {
      fullName: raw,
      firstName,
      lastName: lastName || undefined
    };
  }

  /**
   * Save emergency settings
   */
  async saveEmergencySettings(): Promise<void> {
    try {
      const profile = await this.userService.getCurrentUserProfile();
      if (!profile?.uid) {
        return;
      }

      const uid = profile.uid;

      // Normalize settings payload
      const settings = {
        shakeToAlert: !!this.emergencySettings?.shakeToAlert,
        powerButtonAlert: !!this.emergencySettings?.powerButtonAlert,
        // Default to true unless explicitly turned off
        audioInstructions: this.emergencySettings?.audioInstructions !== false
      };

      // Persist to Firestore via medical service
      await this.medicalService.saveEmergencySettings(uid, settings);

      // Also store on the user profile document so other services see it
      await this.userService.updateUserProfile(uid, {
        emergencySettings: settings
      } as Partial<UserProfile>);

      // Immediately notify the detector service so current session uses new settings
      await this.emergencyDetectorService.updateEmergencySettings(settings as any);

      await this.presentToast('Emergency settings saved');
    } catch (error) {
      console.error('Error saving emergency settings:', error);
      await this.presentToast('Failed to save emergency settings');
    }
  }

  /**
   * Open edit emergency message modal
   */
  async openEditProfileModal(
    emergencyMessage: EmergencyMessage,
    userProfile: UserProfile | null,
    onSave: (message: any) => Promise<void>,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const modal = await this.modalController.create({
      component: EditEmergencyProfileModalComponent,
      componentProps: {
        emergencyMessage,
        userProfile
      },
      cssClass: 'force-white-modal',
      handle: false,
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });

    modal.onDidDismiss().then(async (result: any) => {
      if (result && result.data) {
        await onSave(result.data);
        await onRefresh();
      }
    });

    await modal.present();
  }

  /**
   * Refresh emergency message display
   */
  async refreshEmergencyMessageDisplay(
    loadMedicalData: () => Promise<void>,
    loadEmergencyInstructions: () => Promise<void>
  ): Promise<void> {
    try {
      await loadMedicalData();
      await loadEmergencyInstructions();
    } catch (e) {
      console.error('Error refreshing emergency message display:', e);
    }
  }

  /**
   * Save edited emergency message
   */
  async saveEditedEmergencyMessage(
    message: any,
    userProfile: UserProfile | null,
    onEmergencyMessageUpdate: (msg: EmergencyMessage) => void,
    onUserProfileUpdate: (profile: UserProfile) => void,
    loadMedicalData: () => Promise<void>,
    presentToast: (msg: string) => Promise<void>
  ): Promise<void> {
    const emergencyMessage: EmergencyMessage = {
      name: message?.name || '',
      allergies: message?.allergies || '',
      instructions: message?.instructions || '',
      location: message?.location || ''
    };

    const avatarValue = typeof message?.avatar === 'string'
      ? message.avatar
      : (userProfile?.avatar || '');

    // Optimistic UI update
    onEmergencyMessageUpdate(emergencyMessage);
    if (userProfile) {
      const parsedName = this.parseName(message?.name);
      onUserProfileUpdate({
        ...userProfile,
        ...(parsedName.fullName ? { fullName: parsedName.fullName } : {}),
        ...(parsedName.firstName ? { firstName: parsedName.firstName } : {}),
        ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
        emergencyContactName: message?.emergencyContactName || '',
        emergencyContactPhone: message?.emergencyContactPhone || '',
        dateOfBirth: message?.dateOfBirth || '',
        bloodType: message?.bloodType || '',
        avatar: avatarValue
      });
    }
    
    if (userProfile?.uid) {
      const uid = userProfile.uid;
      try {
        const parsedName = this.parseName(message?.name);
        await this.medicalService.updateEmergencyMessage(uid, emergencyMessage);
        await this.userService.updateUserProfile(uid, {
          emergencyMessage,
          ...(parsedName.fullName ? { fullName: parsedName.fullName } : {}),
          ...(parsedName.firstName ? { firstName: parsedName.firstName } : {}),
          ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
          emergencyContactName: message?.emergencyContactName || '',
          emergencyContactPhone: message?.emergencyContactPhone || '',
          dateOfBirth: message?.dateOfBirth || '',
          bloodType: message?.bloodType || '',
          avatar: avatarValue
        });
        await loadMedicalData();
        this.showEditEmergencyMessageModal = false;
        await presentToast('Emergency message saved successfully');
      } catch (err) {
        console.error('Error saving emergency message:', err);
        await presentToast('Error saving emergency message');
        this.showEditEmergencyMessageModal = false;
      }
    } else {
      this.showEditEmergencyMessageModal = false;
    }
  }

  async saveNewEmergencyMessage(
    message: EmergencyMessageFormData,
    userProfile: UserProfile | null,
    presentToast: (msg: string) => Promise<void>,
    loadMedicalData: () => Promise<void>
  ): Promise<void> {
    const emergencyMessage: EmergencyMessage = {
      name: message?.name || '',
      allergies: message?.allergies || '',
      instructions: message?.instructions || '',
      location: message?.location || ''
    };

    if (!userProfile?.uid) {
      return;
    }

    const uid = userProfile.uid;

    try {
      const parsedName = this.parseName(message?.name);
      await this.medicalService.updateEmergencyMessage(uid, emergencyMessage);
      await this.userService.updateUserProfile(uid, {
        emergencyMessage,
        ...(parsedName.fullName ? { fullName: parsedName.fullName } : {}),
        ...(parsedName.firstName ? { firstName: parsedName.firstName } : {}),
        ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
        emergencyContactName: message?.emergencyContactName || '',
        emergencyContactPhone: message?.emergencyContactPhone || '',
        dateOfBirth: message?.dateOfBirth || '',
        bloodType: message?.bloodType || ''
      });
      await loadMedicalData();
      await presentToast('Emergency message saved successfully');
    } catch (err) {
      console.error('Error saving emergency message:', err);
      await presentToast('Error saving emergency message');
    }
  }

  /**
   * Get normalized emergency instruction entries for display
   */
  getEmergencyInstructionEntries(
    emergencyInstructions: any[],
    emergencyMessage: EmergencyMessage
  ): { label: string; text: string }[] {
    const entries: { label: string; text: string }[] = [];
    
    const general = (emergencyMessage?.instructions || '').trim();
    if (general) {
      entries.push({ label: 'General', text: general });
    }
    
    if (Array.isArray(emergencyInstructions) && emergencyInstructions.length) {
      emergencyInstructions.forEach((instr: any) => {
        const label = instr?.allergyName;
        const text = instr?.instruction;
        if (label && text) entries.push({ label, text });
      });
    }
    
    return entries;
  }

  /**
   * Toggle voice recording modal
   */
  toggleVoiceRecordingModal(): void {
    this.showVoiceSettings = !this.showVoiceSettings;
  }

  /**
   * Centralized emergency feature test runner.
   * Delegates all test logic from the page to this service.
   */
  async runTest(
    type: 'alert' | 'shake' | 'power' | 'audio',
    notify: (message: string) => Promise<void> | void
  ): Promise<void> {
    try {
      switch (type) {
        case 'alert':
          await notify('Emergency alert test triggered');
          break;
        case 'shake':
          await notify('Shake detection test triggered');
          break;
        case 'power':
          await notify('Power button detection test triggered');
          break;
        case 'audio':
          await notify('Audio instructions test triggered');
          break;
      }
    } catch (e) {
      console.error('Emergency test error:', e);
      await this.presentToast('Emergency test failed');
    }
  }

  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
