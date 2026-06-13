import { Injectable } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { MedicalService } from '../../../core/services/medical.profile.service';
import { EmergencyMessage } from '../../../core/services/models/emergency-message.model';
import { UserService } from '../../../core/services/user.service';
import { UserProfile } from '../../../core/services/models/user-profile.model';
import { EditEmergencyProfileModalComponent } from '../overview/modals/edit-profile-message/edit-emergency-profile-modal.component';
import { EmergencyDetectorService } from '../../../core/services/emergency-detector.service';
import { ProfileDetailService } from '../../../core/services/profile-details.service';
import { EmergencySettingsService } from '../../../core/services/emergency-settings.service';

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
    private profileDetailService: ProfileDetailService,
    private emergencyDetectorService: EmergencyDetectorService,
    private emergencySettingsService: EmergencySettingsService
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

      await this.emergencySettingsService.updateForUser(uid, settings as any);
      await this.emergencyDetectorService.updateEmergencySettings(settings as any);

      await this.presentToast('Emergency settings saved');
    } catch (error) {
      console.error('Error saving emergency settings:', error);
      await this.presentToast('Failed to save emergency settings');
    }
  }

  async openEditProfileModal(
    emergencyMessage: EmergencyMessage,
    userProfile: UserProfile | null,
    profileDetails: any,
    onSave: (message: any) => Promise<void>,
    onRefresh: () => Promise<void>
  ): Promise<void> {
    const modal = await this.modalController.create({
      component: EditEmergencyProfileModalComponent,
      componentProps: {
        emergencyMessage,
        userProfile,
        profileDetails
      },
      cssClass: 'force-white-modal',
      handle: false,
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });

    modal.onDidDismiss().then(async (result: any) => {
      if (result?.data) {
        await onSave(result.data);
      }
    });

    await modal.present();
  }

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

  async saveEditedEmergencyMessage(
    message: any,
    userProfile: UserProfile | null,
    setEmergencyMessage: (msg: any) => void,
    setUserProfile: (profile: UserProfile) => void,
    reload: () => Promise<void>,
    presentToast: (msg: string) => Promise<void>
  ): Promise<void> {

    if (!userProfile?.uid) {
      await presentToast('User profile not found.');
      return;
    }

    try {

      const uid = userProfile.uid;

      // Get current profile details first
      const currentDetails =
        await this.profileDetailService.getUserProfileDetails(uid);

      const emergencyMessage: EmergencyMessage = {
        name: message.name || '',
        allergies: message.allergies || '',
        location: message.location || '',
      };

      const updatedFullName =
        message.name || userProfile.fullName || '';

      // Update base profile
      await this.userService.updateUserProfile(uid, {
        fullName: updatedFullName
      });

      // Update profile/details safely
      await this.profileDetailService.updateProfileDetails(uid, {

        phone:
          message.contactNumber ||
          message.contactPhone ||
          message.emergencyContactPhone ||
          currentDetails?.phone ||
          null,

        dateOfBirth:
          message.dateOfBirth ||
          currentDetails?.dateOfBirth ||
          null,

        gender:
          message.gender ||
          currentDetails?.gender ||
          null,

        bloodType:
          message.bloodType ||
          currentDetails?.bloodType ||
          null,

        profile_picture:
          message.profile_picture ||
          currentDetails?.profile_picture ||
          null

      });

      // Update emergency message
      await this.medicalService.updateEmergencyMessage(
        uid,
        emergencyMessage
      );

      // Update emergency instructions
      await this.medicalService.setEmergencyInstruction(
        uid,
        message.instructions || ''
      );

      // Update local state
      setEmergencyMessage({
        ...emergencyMessage,
        instructions: message.instructions || ''
      });

      setUserProfile({
        ...userProfile,
        fullName: updatedFullName
      });

      // Reload fresh Firestore data
      await reload();

      await presentToast(
        'Emergency profile updated successfully.'
      );

    } catch (error) {

      console.error(
        'Error saving emergency profile:',
        error
      );

      await presentToast(
        'Failed to update emergency profile.'
      );
    }
  }

  async saveNewEmergencyMessage(
    message: EmergencyMessageFormData,
    userProfile: UserProfile | null,
    presentToast: (msg: string) => Promise<void>,
    loadMedicalData: () => Promise<void>
  ): Promise<void> {
    if (!userProfile?.uid) return;

    const uid = userProfile.uid;

    const emergencyMessage: EmergencyMessage = {
      name: message?.name || '',
      allergies: message?.allergies || '',
      location: message?.location || ''
    };

    try {
      const parsedName = this.parseName(message?.name);

      await this.medicalService.updateEmergencyMessage(uid, emergencyMessage);

      await this.userService.updateUserProfile(uid, {
        ...(parsedName.fullName ? { fullName: parsedName.fullName } : {}),
        ...(parsedName.firstName ? { firstName: parsedName.firstName } : {}),
        ...(parsedName.lastName ? { lastName: parsedName.lastName } : {}),
      });

      await this.profileDetailService.updateProfileDetails(uid, {
        dateOfBirth: message?.dateOfBirth || null,
        bloodType: message?.bloodType || null,
        
      });

      await loadMedicalData();
      await presentToast('Emergency message saved successfully');
    } catch (err) {
      console.error('Error saving emergency message:', err);
      await presentToast('Error saving emergency message');
    }
  }

  getEmergencyInstructionEntries(
    emergencyInstructions: any[],
    emergencyMessage: EmergencyMessage,
    emergencySettings?: any,
    generalInstruction?: string
  ): { label: string; text: string }[] {
    const entries: { label: string; text: string }[] = [];

    const general = (generalInstruction || '').trim();
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


  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }

  async loadEmergencySettings(uid: string): Promise<void> {
  const settings = await this.emergencySettingsService.getEmergencySettings(uid);

  this.emergencySettings = settings ?? {
    shakeToAlert: false,
    powerButtonAlert: false,
    audioInstructions: true
  };
}
}