import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { MedicalService } from './medical.profile.service';
import { BuddyService } from './buddy.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { EmergencyService } from './emergency.service';
import { EmergencySettingsService } from './emergency-settings.service';

export interface EmergencyAlert {
  id: string;
  uid: string;
  timestamp: Date;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  alertType: 'shake' | 'volume-button' | 'manual' | 'buddy-request';
  status: 'active' | 'resolved' | 'cancelled';
  emergencyData: EmergencyData;
  notifiedBuddies: string[];
  responderIds: string[];
}

export interface EmergencyData {
  name?: string;
  allergies?: string;
  emergencyInstruction?: string;
  emergencyInstructions?: { allergyName: string; instruction: string }[];
  emergencyMessage?: {
    audioUrl?: string;
    instructions?: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyAlertService {

  constructor(
    private buddyService: BuddyService,
    private authService: AuthService,
    private userService: UserService,
    private emergencyService: EmergencyService,
    private toastController: ToastController,
    private emergencySettingsService: EmergencySettingsService,
    private medicalService: MedicalService
  ) {}

  async triggerEmergencyAlert(
    alertType: 'shake' | 'volume-button' | 'manual' = 'manual'
  ): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const userProfile = await this.userService.getUserProfile(currentUser.uid);

      const fullNameParts: string[] = [];
      if (userProfile?.firstName) fullNameParts.push(userProfile.firstName);
      if (userProfile?.lastName) fullNameParts.push(userProfile.lastName);
      const derivedName = fullNameParts.join(' ').trim();

      const userName = (
        userProfile?.fullName || derivedName || currentUser.email || 'User'
      ).trim();

      const medicalData = await this.medicalService.getEmergencyData(currentUser.uid);
      const resolvedInstruction = medicalData?.emergencyInstruction?.trim() || '';

      const buddies = await this.buddyService.getUserBuddies(currentUser.uid);
      const buddyIds = Array.from(
        new Set(
          buddies
            .map((buddy: any) => buddy.connectedUserId || buddy.buddyUid || buddy.id)
            .filter((id: any) => !!id && id !== currentUser.uid)
        )
      );

      if (buddyIds.length === 0) {
        console.warn('No emergency buddies configured.');
        await this.showToast(
          'Warning: No emergency contacts configured. Alert will be sent without notifying anyone.',
          'warning'
        );
      }

      console.log('Getting current location before sending emergency alert...');


      let locationData: { latitude: number; longitude: number; accuracy?: number } | undefined;

      try {
        const position = await this.emergencyService.getCurrentLocation();
        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
      } catch (locationError) {
        console.warn('Location unavailable for emergency trigger, proceeding without it:', locationError);
        await this.showToast('Location unavailable — sending alert without location.', 'warning');
        locationData = undefined;
      }

      console.log('Sending full emergency via EmergencyService from', alertType, 'trigger');

  
      await this.emergencyService.sendEmergencyAlert(
        currentUser.uid,
        userName,
        buddyIds,
        [],
        resolvedInstruction,
        locationData
      );

      await this.showToast('Emergency alert sent successfully.', 'success');
      console.log('Emergency alert sent successfully via EmergencyService');

      await this.logEmergencyAlert(
        currentUser.uid,
        alertType,
        locationData,
        medicalData,
        buddies
      );

    } catch (error) {
      console.error('Error triggering emergency alert:', error);
      await this.showToast('Failed to send emergency alert. Please try again.', 'danger');
      throw error;
    }
  }

  private async sendEmergencyNotification(
    buddy: { name: string; id: string },
    alertMessage: string,
    location?: { latitude: number; longitude: number }
  ): Promise<void> {
    try {
      console.log(`Sending emergency notification to buddy ${buddy.name}:`, alertMessage, location);
    } catch (error) {
      console.error('Error sending notification to buddy:', buddy.name, error);
    }
  }

  private async logEmergencyAlert(
    uid: string,
    alertType: string,
    location: { latitude: number; longitude: number; accuracy?: number } | undefined,
    emergencyData: EmergencyData,
    buddies: { id: string }[]
  ): Promise<void> {
    try {
      const alertLog: Partial<EmergencyAlert> = {
        uid,
        alertType: alertType as EmergencyAlert['alertType'],
        location,
        emergencyData,
        notifiedBuddies: buddies.map(b => b.id),
        timestamp: new Date(),
        status: 'active'
      };
      console.log('Emergency alert logged:', alertLog);
    } catch (error) {
      console.error('Error logging emergency alert:', error);
    }
  }

  private sanitizeText(input: string): string {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(input));
    return div.innerHTML;
  }

  formatEmergencyInstructionForDisplay(emergencyData: EmergencyData): string {
    const { emergencyInstructions, emergencyInstruction, name, allergies } = emergencyData;

    const safeName = this.sanitizeText(name || 'Unknown');

    let display = `<div class="emergency-instruction-box">`;
    display += `<h3>Emergency Instructions for ${safeName}</h3>`;

    if (emergencyInstructions && emergencyInstructions.length > 0) {
      display += `<div class="emergency-instructions-list">`;
      emergencyInstructions.forEach((instruction) => {
        const safeAllergyName = this.sanitizeText(instruction.allergyName);
        const safeInstruction = this.sanitizeText(instruction.instruction);
        display += `<div class="instruction-item">`;
        display += `<strong>${safeAllergyName}:</strong> ${safeInstruction}`;
        display += `</div>`;
      });
      display += `</div>`;
    } else if (emergencyInstruction) {
      const safeAllergies = allergies ? this.sanitizeText(allergies) : null;
      const safeInstruction = this.sanitizeText(emergencyInstruction);
      if (safeAllergies && safeAllergies !== 'None') {
        display += `<p><strong>Allergies:</strong> ${safeAllergies}</p>`;
      }
      display += `<p><strong>Instructions:</strong> ${safeInstruction}</p>`;
    } else {
      display += `<p><strong>Instructions:</strong> Use EpiPen immediately if available. Call 911.</p>`;
    }

    display += `</div>`;
    return display;
  }

  async playAudioInstructions(emergencyData: EmergencyData): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (currentUser) {
        const settings = await this.emergencySettingsService.getEmergencySettings(currentUser.uid);
        const audioEnabled = settings?.audioInstructions ?? true;
        if (!audioEnabled) {
          console.log('Audio instructions disabled by user settings');
          return;
        }
      }

      const audioUrl = emergencyData.emergencyMessage?.audioUrl;
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        await audio.play();
        console.log('Playing audio emergency instructions');
      } else {
        await this.speakInstructions(emergencyData);
      }
    } catch (error) {
      console.error('Error playing audio instructions:', error);
      await this.showToast('Could not play audio instructions. Please read the on-screen instructions.', 'warning');
    }
  }

  private async speakInstructions(emergencyData: EmergencyData): Promise<void> {
    try {
      if (typeof window === 'undefined') {
        console.warn('Text-to-speech not available: window is undefined');
        return;
      }

      const hasSpeechSynthesis = 'speechSynthesis' in window;
      const hasUtteranceConstructor = typeof SpeechSynthesisUtterance !== 'undefined';

      if (!hasSpeechSynthesis || !hasUtteranceConstructor) {
        console.warn('Text-to-speech not supported on this device');
        await this.showToast('Text-to-speech not supported on this device', 'warning');
        return;
      }

      window.speechSynthesis.cancel();

      const { emergencyInstructions, emergencyInstruction, emergencyMessage, name, allergies } = emergencyData;

      let textToSpeak = '';

      if (emergencyInstructions && emergencyInstructions.length > 0) {
        textToSpeak = `Emergency alert for ${name || 'this person'}. Emergency instructions: `;
        emergencyInstructions.forEach((instruction) => {
          textToSpeak += `${instruction.allergyName}: ${instruction.instruction}. `;
        });
      } else if (emergencyInstruction) {
        textToSpeak = emergencyInstruction;
      } else if (emergencyMessage?.instructions) {
        textToSpeak = `Emergency alert for ${name || 'this person'}. `;
        if (allergies && allergies !== 'None') {
          textToSpeak += `They are allergic to ${allergies}. `;
        }
        textToSpeak += emergencyMessage.instructions;
      } else {
        textToSpeak = `Emergency alert for ${name || 'this person'}. `;
        textToSpeak += (allergies && allergies !== 'None')
          ? `They are allergic to ${allergies}. Call emergency services immediately.`
          : 'Call emergency services immediately.';
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.8;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v =>
        v.lang.startsWith('en') &&
        (v.name.includes('Google') || v.name.includes('Microsoft'))
      ) || voices.find(v => v.lang.startsWith('en'));

      if (englishVoice) utterance.voice = englishVoice;

      window.speechSynthesis.speak(utterance);
      console.log('Speaking emergency instructions:', textToSpeak);

    } catch (error) {
      console.error('Error using text-to-speech:', error);
    }
  }

  private async showToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}