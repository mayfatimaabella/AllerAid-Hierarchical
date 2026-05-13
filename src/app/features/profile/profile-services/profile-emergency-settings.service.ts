import { Injectable } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { MedicalService, EmergencyMessage } from '../../../core/services/medical.profile.service';
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
    if (!raw) return {};
    const parts = raw.split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return { fullName: raw, firstName, lastName: lastName || undefined };
  }

  /**
   * Save emergency toggle settings (shakeToAlert, powerButtonAlert, audioInstructions).
   * These booleans live exclusively in settings/preferences.emergencySettings.
   * MedicalService is not involved here.
   */
  async saveEmergencySettings(): Promise<void> {
    try {
      const profile = await this.userService.getCurrentUserProfile();
      if (!profile?.uid) return;

      const uid = profile.uid;

      const settings = {
        shakeToAlert: !!this.emergencySettings?.shakeToAlert,
        powerButtonAlert: !!this.emergencySettings?.powerButtonAlert,
        audioInstructions: this.emergencySettings?.audioInstructions !== false
      };

      // Single source of truth: settings/preferences.emergencySettings via UserService
      await this.userService.updateUserProfile(uid, {
        emergencySettings: settings
      } as Partial<UserProfile>);

      // Notify detector service so current session picks up new settings immediately
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
      componentProps: { emergencyMessage, userProfile },
      cssClass: 'force-white-modal',
      handle: false,
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });

    modal.onDidDismiss().then(async (result: any) => {
      if (result?.data) {
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

    const profileValue = typeof message?.avatar === 'string'
      ? message.avatar
      : (userProfile?.profile_picture || '');

    onEmergencyMessageUpdate(emergencyMessage);
    if (userProfile) {
      const parsedName = this.parseName(message?.name);
      onUserProfileUpdate({
        ...userProfile,
        ...(parsedName.fullName ? { fullName: parsedName.fullName } : {}),
        ...(parsedName.firstName ? { firstName: parsedName.firstName } : {}),
        ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
        dateOfBirth: message?.dateOfBirth || '',
        bloodType: message?.bloodType || '',
        profile_picture: profileValue
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
          dateOfBirth: message?.dateOfBirth || '',
          bloodType: message?.bloodType || '',
          profile_picture: profileValue
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

    if (!userProfile?.uid) return;

    const uid = userProfile.uid;

    try {
      const parsedName = this.parseName(message?.name);
      await this.medicalService.updateEmergencyMessage(uid, emergencyMessage);
      await this.userService.updateUserProfile(uid, {
        emergencyMessage,
        ...(parsedName.fullName ? { fullName: parsedName.fullName } : {}),
        ...(parsedName.firstName ? { firstName: parsedName.firstName } : {}),
        ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
        dateOfBirth: message?.dateOfBirth || '',
        bloodType: message?.bloodType || '',
      });
      await loadMedicalData();
      await presentToast('Emergency message saved successfully');
    } catch (err) {
      console.error('Error saving emergency message:', err);
      await presentToast('Error saving emergency message');
    }
  }

  /**
   * Get normalized emergency instruction entries for display.
   * Reads generalInstruction from medical/info.emergencyInstruction (root field).
   */
  getEmergencyInstructionEntries(
    emergencyInstructions: any[],
    emergencyMessage: EmergencyMessage,
    emergencySettings?: any
  ): { label: string; text: string }[] {
    const entries: { label: string; text: string }[] = [];

    // emergencySettings.generalInstruction was the old nested path — no longer written.
    // Fall back to emergencyMessage.instructions which mirrors emergencyInstruction on save.
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

  toggleVoiceRecordingModal(): void {
    this.showVoiceSettings = !this.showVoiceSettings;
  }

  async runTest(
    type: 'alert' | 'shake' | 'power' | 'audio',
    notify: (message: string) => Promise<void> | void
  ): Promise<void> {
    try {
      const messages: Record<typeof type, string> = {
        alert: 'Emergency alert test triggered',
        shake: 'Shake detection test triggered',
        power: 'Power button detection test triggered',
        audio: 'Audio instructions test triggered'
      };
      await notify(messages[type]);
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