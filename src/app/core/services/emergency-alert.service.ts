import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { MedicalService } from './medical.profile.service';
import { BuddyService } from './buddy.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { EmergencyService } from './emergency.service';
import { EmergencySettingsService } from './emergency-settings.service';
import { Timestamp } from 'firebase/firestore';
import { Buddy } from '../models/buddy.model';
import { EmergencyData } from '../models/emergency-data.model';
import { EmergencyAlert } from '../models/emergency-alert.model';

export interface TriggerEmergencyResult {
    emergencyId: string;
    location?: {
        latitude: number;
        longitude: number;
        accuracy?: number;
    };
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyAlertService {

  private emergencyAlarmLoopTimer: ReturnType<typeof setInterval> | null = null;
  private isEmergencyAlarmLooping = false;
  private readonly defaultEmergencyAlarmText = 'Emergency alert. Please stay calm. Help is on the way.';

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
  ): Promise<TriggerEmergencyResult> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const userProfile = await this.userService.getUserProfile(currentUser.uid);

      const userName = this.getUserDisplayName(userProfile, currentUser);

      const medicalData = await this.medicalService.getEmergencyData(currentUser.uid);
      const resolvedInstruction = medicalData?.emergencyInstruction?.trim() || '';

      const buddies = await this.buddyService.getUserBuddies(currentUser.uid);

      const buddyIds = this.getBuddyIds(buddies, currentUser.uid);

      if (buddyIds.length === 0) {
        console.warn('No emergency buddies configured.');
        await this.showToast(
          'Warning: No emergency contacts configured. Alert will be sent without notifying anyone.',
          'warning'
        );
      }

      const initialBuddyResponses = this.buildInitialBuddyResponses(buddies,currentUser.uid);

      console.log('Getting current location before sending emergency alert...');

      const locationData = await this.getEmergencyLocation();
      const locationText = await this.getLocationDisplayText(locationData);

      const emergencyAlarmText = this.buildEmergencyAlarmText(
        userName,
        medicalData,
        locationText
      );

      console.log('Sending full emergency via EmergencyService from', alertType, 'trigger');

      await this.playEmergencyAlarmSound(emergencyAlarmText);

      const emergencyId = await this.emergencyService.sendEmergencyAlert(
        currentUser.uid,
        userName,
        buddyIds,
        [],
        resolvedInstruction,
        locationData,
        initialBuddyResponses
      );

      
      console.log('Emergency alert sent successfully via EmergencyService');

      await this.logEmergencyAlert(
        currentUser.uid,
        alertType,
        locationData,
        medicalData,
        buddies
      );
      return { emergencyId, location: locationData };

    } catch (error) {
      this.stopEmergencyAlarmSound();

      console.error('Error triggering emergency alert:', error);
      throw error;
    }
  }

  private buildInitialBuddyResponses(
    buddies: Buddy[],
    currentUserUid: string,
  ): {
    [buddyId: string]: {
      status: 'sent';
      timestamp: Timestamp;
      name: string;
    };
  } {
    return buddies.reduce((responses, buddy: Buddy) => {
      const buddyId = buddy.connectedUserId || buddy.buddyUid || buddy.id;
 
      if (!buddyId || buddyId === currentUserUid) {
        return responses;
      }

      responses[buddyId] = {
        status: 'sent',
        timestamp: Timestamp.now(),
        name:
          buddy.buddyName.trim() || buddyId,
      };

      return responses;
    }, {} as {
      [buddyId: string]: {
        status: 'sent';
        timestamp: Timestamp;
        name: string;
      };
    });
  }

  private async getEmergencyLocation(): Promise<
  { latitude: number; longitude: number; accuracy?: number } | undefined
> {
  try {
    const position = await this.emergencyService.getCurrentLocation();

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch (locationError) {
    console.warn(
      'Location unavailable for emergency trigger, proceeding without it:',
      locationError
    );

    await this.showToast(
      'Location unavailable — sending alert without location.',
      'warning'
    );

    return undefined;
  }
}

  private getBuddyIds(buddies: Buddy[], currentUserUid: string): string[] {
    return Array.from(
      new Set(
        buddies
          .map((buddy: Buddy) => buddy.connectedUserId || buddy.buddyUid || buddy.id)
          .filter((id: string) => !!id && id !== currentUserUid)
      )
    );
  }

  private getUserDisplayName(userProfile: any, currentUser: any): string {
  const fullNameParts: string[] = [];

      if (userProfile?.firstName) {
        fullNameParts.push(userProfile.firstName);
      }

      if (userProfile?.lastName) {
        fullNameParts.push(userProfile.lastName);
      }

      const derivedName = fullNameParts.join(' ').trim();

      return (
        userProfile?.fullName ||
        derivedName ||
        currentUser.email ||
        'User'
      ).trim();
    }

  async playEmergencyAlarmSound(textToSpeak: string = this.defaultEmergencyAlarmText): Promise<void> {
    this.stopEmergencyAlarmSound();

    const message = textToSpeak?.trim() || this.defaultEmergencyAlarmText;
    this.isEmergencyAlarmLooping = true;

    try {
      await this.speakEmergencyAlarmText(message);

      this.emergencyAlarmLoopTimer = setInterval(() => {
        void this.speakEmergencyAlarmText(message);
      }, 8_000);

      console.log('Emergency alarm loop started');
    } catch (error) {
      console.warn('Could not play emergency alarm sound:', error);
    }
  }

  private async getLocationDisplayText(
    locationData?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<string> {
    if (!locationData || !Number.isFinite(locationData.latitude) || !Number.isFinite(locationData.longitude)) {
      return 'Location unavailable';
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${locationData.latitude}&lon=${locationData.longitude}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Reverse geocode HTTP ${response.status}`);
      }

      const data = await response.json();
      const displayName = data?.display_name?.trim();
      if (displayName) {
        return displayName;
      }
    } catch (error) {
      console.warn('Reverse geocode failed for emergency TTS location text:', error);
    }

    return `Latitude ${locationData.latitude}, Longitude ${locationData.longitude}`;
  }

  private buildEmergencyAlarmText(
    patientName: string,
    medicalData: any | null,
    locationText: string
  ): string {
    const allergyList = this.extractAllergyLabels(medicalData);
    const specificInstructions = this.extractPerAllergyEmergencyInstructions(medicalData);
    const generalInstruction = String(medicalData?.generalEmergencyInstruction ?? medicalData?.emergencyInstruction ?? '').trim();

    const allergies = allergyList.length > 0 ? allergyList.join(', ') : 'No known allergies listed';
    const instructions = specificInstructions.length > 0
      ? `${specificInstructions.join(' ')} ${generalInstruction ? `${generalInstruction}.` : ''}`.trim()
      : generalInstruction || 'Follow general emergency instructions and call emergency services immediately.';

    return `Emergency alert for ${patientName}. Allergies: ${allergies}. Instructions: ${instructions}. Location: ${locationText}.`;
  }

  private extractAllergyLabels(medicalData: any | null): string[] {
    const fromData = medicalData?.allergies;
    if (Array.isArray(fromData)) {
      return fromData
        .map((entry: any) => typeof entry === 'string'
          ? entry
          : entry?.name || entry?.allergyName || entry?.label || entry?.value || '')
        .filter(Boolean);
    }

    if (typeof fromData === 'string' && fromData.trim()) {
      return fromData.split(',').map(item => item.trim()).filter(Boolean);
    }

    return [];
  }

  private extractPerAllergyEmergencyInstructions(medicalData: any | null): string[] {
    const instructions = medicalData?.allergyEmergencyInstructions ?? medicalData?.emergencyInstructions;
    if (!Array.isArray(instructions) || instructions.length === 0) {
      return [];
    }

    return instructions
      .map((entry: any) => {
        const allergyName = entry?.allergyName || entry?.allergy || entry?.name || 'allergy';
        const instruction = entry?.instruction || entry?.note || '';
        return instruction ? `${allergyName}: ${instruction}` : '';
      })
      .filter(Boolean);
  }

  private async speakEmergencyAlarmText(textToSpeak: string): Promise<void> {
    if (!this.isEmergencyAlarmLooping) {
      return;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        await TextToSpeech.speak({
          text: textToSpeak,
          lang: 'en-US',
          rate: 0.9,
          pitch: 1,
          volume: 1,
          category: 'playback',
          queueStrategy: 1,
        });
        console.log('Speaking emergency alarm natively:', textToSpeak);
        return;
      }

      if (typeof window === 'undefined') {
        console.warn('Text-to-speech not available: window is undefined');
        return;
      }

      const hasSpeechSynthesis = 'speechSynthesis' in window;
      const hasUtteranceConstructor = typeof SpeechSynthesisUtterance !== 'undefined';

      if (!hasSpeechSynthesis || !hasUtteranceConstructor) {
        console.warn('Text-to-speech not supported on this device');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.volume = 1.0;
      utterance.pitch = 1.0;

      window.speechSynthesis.speak(utterance);
      console.log('Speaking emergency alarm:', textToSpeak);
    } catch (error) {
      console.error('Error using text-to-speech for emergency alarm:', error);
    }
  }

  stopEmergencyAlarmSound(): void {
    this.isEmergencyAlarmLooping = false;

    if (this.emergencyAlarmLoopTimer !== null) {
      clearInterval(this.emergencyAlarmLoopTimer);
      this.emergencyAlarmLoopTimer = null;
    }

    if (Capacitor.isNativePlatform()) {
      void TextToSpeech.stop();
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    console.log('Emergency alarm sound stopped');
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
    buddies: Buddy[]
  ): Promise<void> {
    try {
      const alertLog = {
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
      const textToSpeak = this.buildEmergencyInstructionText(emergencyData);

      if (Capacitor.isNativePlatform()) {
        await TextToSpeech.speak({
          text: textToSpeak,
          lang: 'en-US',
          rate: 0.8,
          pitch: 1,
          volume: 1,
          category: 'playback',
          queueStrategy: 0
        });
        console.log('Speaking emergency instructions natively:', textToSpeak);
        return;
      }

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

  private buildEmergencyInstructionText(emergencyData: EmergencyData): string {
    const { emergencyInstructions, emergencyInstruction, emergencyMessage, name, allergies } = emergencyData;

    if (emergencyInstructions && emergencyInstructions.length > 0) {
      let text = `Emergency alert for ${name || 'this person'}. Emergency instructions: `;
      emergencyInstructions.forEach((instruction) => {
        text += `${instruction.allergyName}: ${instruction.instruction}. `;
      });
      return text;
    }

    if (emergencyInstruction) {
      return emergencyInstruction;
    }

    if (emergencyMessage?.instructions) {
      let text = `Emergency alert for ${name || 'this person'}. `;
      if (allergies && allergies !== 'None') {
        text += `They are allergic to ${allergies}. `;
      }
      text += emergencyMessage.instructions;
      return text;
    }

    return `Emergency alert for ${name || 'this person'}. ` +
      ((allergies && allergies !== 'None')
        ? `They are allergic to ${allergies}. Call emergency services immediately.`
        : 'Call emergency services immediately.');
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