import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Timestamp } from 'firebase/firestore';

import { MedicalService } from './medical.service';
import { BuddyService } from './buddy.service';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { EmergencyService } from './emergency.service';
import { EmergencySettingsService } from './emergency-settings.service';

import { Buddy } from '../models/buddy.model';
import { EmergencyData } from '../models/emergency-data.model';
import { EmergencyAlert } from '../models/emergency-alert.model';

export type EmergencyAlertTrigger =
  | 'shake'
  | 'volume-button'
  | 'smartwatch'
  | 'manual';

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyAlertService {

  private emergencyAlarmLoopTimer: ReturnType<typeof setInterval> | null = null;
  private isEmergencyAlarmLooping = false;

  private readonly defaultEmergencyAlarmText =
    'Emergency alert. Please stay calm. Help is on the way.';

  private readonly emergencyAlarmInterval = 8000;

  constructor(
    private buddyService: BuddyService,
    private authService: AuthService,
    private userService: UserService,
    private emergencyService: EmergencyService,
    private toastController: ToastController,
    private emergencySettingsService: EmergencySettingsService,
    private medicalService: MedicalService
  ) {}

  /**
   * Triggers a complete emergency alert.
   *
   * Steps:
   * 1. Get authenticated user.
   * 2. Load profile and medical information.
   * 3. Load emergency buddies.
   * 4. Get current location.
   * 5. Build emergency TTS message.
   * 6. Start emergency alarm.
   * 7. Send emergency through EmergencyService.
   * 8. Log the emergency locally.
   */
  async triggerEmergencyAlert(
    alertType: EmergencyAlertTrigger = 'manual'
  ): Promise<{
    emergencyId: string;
    location: EmergencyLocation | undefined;
  }> {
    let location: EmergencyLocation | undefined;

    try {
      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      console.log(
        'Triggering emergency alert:',
        alertType,
        'for user:',
        currentUser.uid
      );

      
      // USER PROFILE
      

      const userProfile = await this.userService.getUserProfile(
        currentUser.uid
      );

      const userName = this.getUserDisplayName(
        userProfile,
        currentUser
      );

      
      // MEDICAL DATA
      

      const medicalData =
        await this.medicalService.getEmergencyData(
          currentUser.uid
        );

      const resolvedInstruction =
        medicalData?.emergencyInstruction?.trim() || '';

      
      // EMERGENCY BUDDIES
      

      const buddies =
        await this.buddyService.getUserBuddies(
          currentUser.uid
        );

      const buddyIds = this.getBuddyIds(
        buddies,
        currentUser.uid
      );

      if (buddyIds.length === 0) {
        console.warn(
          'No emergency buddies configured.'
        );

        await this.showToast(
          'Warning: No emergency contacts configured. Alert will be sent without notifying anyone.',
          'warning'
        );
      }

      const initialBuddyResponses =
        this.buildInitialBuddyResponses(
          buddies,
          currentUser.uid
        );

      
      // LOCATION
      

      console.log(
        'Getting current location before sending emergency alert...'
      );

      location = await this.getEmergencyLocation();

      const locationText =
        await this.getLocationDisplayText(location);

      
      // EMERGENCY ALARM
      

      const emergencyAlarmText =
        this.buildEmergencyAlarmText(
          userName,
          medicalData,
          locationText
        );

      await this.playEmergencyAlarmSound(
        emergencyAlarmText
      );

      
      // SEND EMERGENCY
      

      console.log(
        'Sending emergency via EmergencyService from',
        alertType,
        'trigger'
      );

      const emergencyId =
        await this.emergencyService.sendEmergencyAlert(
          currentUser.uid,
          userName,
          buddyIds,
          [],
          resolvedInstruction,
          location,
          initialBuddyResponses
        );

      console.log(
        'Emergency alert sent successfully:',
        emergencyId
      );

      
      // LOG ALERT
      

      await this.logEmergencyAlert(
        currentUser.uid,
        alertType,
        location,
        medicalData,
        buddies,
        emergencyId
      );

      return {
        emergencyId,
        location
      };

    } catch (error) {
      this.stopEmergencyAlarmSound();

      console.error(
        'Error triggering emergency alert:',
        error
      );

      throw error;
    }
  }

  /**
   * Builds the initial buddy response map.
   */
  private buildInitialBuddyResponses(
    buddies: Buddy[],
    currentUserUid: string
  ): {
    [buddyId: string]: {
      status: 'sent';
      timestamp: Timestamp;
      name: string;
    };
  } {
    return buddies.reduce(
      (responses, buddy: Buddy) => {
        const buddyId =
          buddy.connectedUserId ||
          buddy.buddyUid ||
          buddy.id;

        if (!buddyId || buddyId === currentUserUid) {
          return responses;
        }

        const buddyName =
          typeof buddy.buddyName === 'string'
            ? buddy.buddyName.trim()
            : '';

        responses[buddyId] = {
          status: 'sent',
          timestamp: Timestamp.now(),
          name: buddyName || buddyId
        };

        return responses;
      },
      {} as {
        [buddyId: string]: {
          status: 'sent';
          timestamp: Timestamp;
          name: string;
        };
      }
    );
  }

  /**
   * Gets the current device location.
   */
  private async getEmergencyLocation(): Promise<
    EmergencyLocation | undefined
  > {
    try {
      const position =
        await this.emergencyService.getCurrentLocation();

      if (!position?.coords) {
        throw new Error(
          'Location service returned no coordinates'
        );
      }

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        throw new Error(
          'Invalid latitude or longitude returned'
        );
      }

      return {
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy)
          ? accuracy
          : undefined
      };

    } catch (locationError) {
      console.warn(
        'Location unavailable for emergency trigger. Continuing without location:',
        locationError
      );

      await this.showToast(
        'Location unavailable — sending alert without location.',
        'warning'
      );

      return undefined;
    }
  }

  /**
   * Converts buddies into unique Firebase user IDs.
   */
  private getBuddyIds(
    buddies: Buddy[],
    currentUserUid: string
  ): string[] {
    return Array.from(
      new Set(
        buddies
          .map(
            (buddy: Buddy) =>
              buddy.connectedUserId ||
              buddy.buddyUid ||
              buddy.id
          )
          .filter(
            (id): id is string =>
              typeof id === 'string' &&
              id.length > 0 &&
              id !== currentUserUid
          )
      )
    );
  }

  /**
   * Creates a readable display name for the current user.
   */
  private getUserDisplayName(
    userProfile: any,
    currentUser: any
  ): string {
    const fullNameParts: string[] = [];

    if (
      typeof userProfile?.firstName === 'string' &&
      userProfile.firstName.trim()
    ) {
      fullNameParts.push(
        userProfile.firstName.trim()
      );
    }

    if (
      typeof userProfile?.lastName === 'string' &&
      userProfile.lastName.trim()
    ) {
      fullNameParts.push(
        userProfile.lastName.trim()
      );
    }

    const derivedName =
      fullNameParts.join(' ').trim();

    const fullName =
      typeof userProfile?.fullName === 'string'
        ? userProfile.fullName.trim()
        : '';

    const email =
      typeof currentUser?.email === 'string'
        ? currentUser.email.trim()
        : '';

    return (
      fullName ||
      derivedName ||
      email ||
      'User'
    );
  }

  /**
   * Starts the repeating emergency alarm.
   */
  async playEmergencyAlarmSound(
    textToSpeak: string = this.defaultEmergencyAlarmText
  ): Promise<void> {
    this.stopEmergencyAlarmSound();

    const message =
      textToSpeak?.trim() ||
      this.defaultEmergencyAlarmText;

    this.isEmergencyAlarmLooping = true;

    try {
      await this.speakEmergencyAlarmText(message);

      if (!this.isEmergencyAlarmLooping) {
        return;
      }

      this.emergencyAlarmLoopTimer =
        setInterval(() => {
          if (!this.isEmergencyAlarmLooping) {
            return;
          }

          void this.speakEmergencyAlarmText(message);
        }, this.emergencyAlarmInterval);

      console.log(
        'Emergency alarm loop started'
      );

    } catch (error) {
      console.warn(
        'Could not play emergency alarm sound:',
        error
      );
    }
  }

  /**
   * Reverse geocodes coordinates into a readable address.
   */
  private async getLocationDisplayText(
    locationData?: EmergencyLocation
  ): Promise<string> {
    if (
      !locationData ||
      !Number.isFinite(locationData.latitude) ||
      !Number.isFinite(locationData.longitude)
    ) {
      return 'Location unavailable';
    }

    try {
      const url =
        `https://nominatim.openstreetmap.org/reverse` +
        `?format=jsonv2` +
        `&lat=${encodeURIComponent(locationData.latitude)}` +
        `&lon=${encodeURIComponent(locationData.longitude)}`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(
          `Reverse geocode HTTP ${response.status}`
        );
      }

      const data = await response.json();

      const displayName =
        typeof data?.display_name === 'string'
          ? data.display_name.trim()
          : '';

      if (displayName) {
        return displayName;
      }

    } catch (error) {
      console.warn(
        'Reverse geocode failed:',
        error
      );
    }

    return (
      `Latitude ${locationData.latitude.toFixed(6)}, ` +
      `Longitude ${locationData.longitude.toFixed(6)}`
    );
  }

  /**
   * Creates the emergency alarm message.
   */
  private buildEmergencyAlarmText(
    patientName: string,
    medicalData: EmergencyData | null | undefined,
    locationText: string
  ): string {
    const allergyList =
      this.extractAllergyLabels(medicalData);

    const specificInstructions =
      this.extractPerAllergyEmergencyInstructions(
        medicalData
      );

    const generalInstruction =
      String(
        medicalData?.generalEmergencyInstruction ??
        medicalData?.emergencyInstruction ??
        ''
      ).trim();

    const allergies =
      allergyList.length > 0
        ? allergyList.join(', ')
        : 'No known allergies listed';

    let instructions: string;

    if (specificInstructions.length > 0) {
      instructions =
        specificInstructions.join('. ');

      if (generalInstruction) {
        instructions += `. ${generalInstruction}`;
      }
    } else if (generalInstruction) {
      instructions = generalInstruction;
    } else {
      instructions =
        'Follow general emergency instructions and call emergency services immediately';
    }

    return (
      `Emergency alert for ${patientName}. ` +
      `Allergies: ${allergies}. ` +
      `Instructions: ${instructions}. ` +
      `Location: ${locationText}.`
    );
  }

  /**
   * Extracts allergy names from different possible data formats.
   */
  private extractAllergyLabels(
    medicalData: EmergencyData | null | undefined
  ): string[] {
    const fromData: any =
      medicalData?.allergies;

    if (Array.isArray(fromData)) {
      return fromData
        .map((entry: any) => {
          if (typeof entry === 'string') {
            return entry.trim();
          }

          return (
            entry?.name ||
            entry?.allergyName ||
            entry?.label ||
            entry?.value ||
            ''
          )
            .toString()
            .trim();
        })
        .filter(
          (value: string) => value.length > 0
        );
    }

    if (
      typeof fromData === 'string' &&
      fromData.trim()
    ) {
      return fromData
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  /**
   * Extracts allergy-specific emergency instructions.
   */
  private extractPerAllergyEmergencyInstructions(
    medicalData: EmergencyData | null | undefined
  ): string[] {
    const instructions: any =
      (medicalData as any)?.allergyEmergencyInstructions ??
      medicalData?.emergencyInstructions;

    if (
      !Array.isArray(instructions) ||
      instructions.length === 0
    ) {
      return [];
    }

    return instructions
      .map((entry: any) => {
        const allergyName =
          entry?.allergyName ||
          entry?.allergy ||
          entry?.name ||
          'Allergy';

        const instruction =
          entry?.instruction ||
          entry?.note ||
          '';

        if (!instruction) {
          return '';
        }

        return `${allergyName}: ${instruction}`;
      })
      .filter(
        (value: string) => value.length > 0
      );
  }

  /**
   * Speaks the emergency alarm message.
   */
  private async speakEmergencyAlarmText(
    textToSpeak: string
  ): Promise<void> {
    if (!this.isEmergencyAlarmLooping) {
      return;
    }

    try {
      // -------------------------------------------------------
      // NATIVE
      // -------------------------------------------------------

      if (Capacitor.isNativePlatform()) {
        await TextToSpeech.speak({
          text: textToSpeak,
          lang: 'en-US',
          rate: 0.9,
          pitch: 1,
          volume: 1,
          category: 'playback',
          queueStrategy: 1
        });

        console.log(
          'Speaking emergency alarm natively:',
          textToSpeak
        );

        return;
      }

      // -------------------------------------------------------
      // WEB
      // -------------------------------------------------------

      if (typeof window === 'undefined') {
        console.warn(
          'Text-to-speech unavailable: window is undefined'
        );
        return;
      }

      if (
        !('speechSynthesis' in window) ||
        typeof SpeechSynthesisUtterance === 'undefined'
      ) {
        console.warn(
          'Text-to-speech is not supported on this device'
        );
        return;
      }

      // Prevent queued emergency messages from piling up.
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          textToSpeak
        );

      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.volume = 1;
      utterance.pitch = 1;

      const voices =
        window.speechSynthesis.getVoices();

      const englishVoice =
        voices.find(
          voice =>
            voice.lang.startsWith('en') &&
            (
              voice.name.includes('Google') ||
              voice.name.includes('Microsoft')
            )
        ) ||
        voices.find(
          voice => voice.lang.startsWith('en')
        );

      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      window.speechSynthesis.speak(
        utterance
      );

      console.log(
        'Speaking emergency alarm:',
        textToSpeak
      );

    } catch (error) {
      console.error(
        'Error using text-to-speech for emergency alarm:',
        error
      );
    }
  }

  /**
   * Stops the emergency alarm and cancels TTS.
   */
  stopEmergencyAlarmSound(): void {
    this.isEmergencyAlarmLooping = false;

    if (
      this.emergencyAlarmLoopTimer !== null
    ) {
      clearInterval(
        this.emergencyAlarmLoopTimer
      );

      this.emergencyAlarmLoopTimer = null;
    }

    if (Capacitor.isNativePlatform()) {
      void TextToSpeech.stop().catch(error => {
        console.warn(
          'Could not stop native text-to-speech:',
          error
        );
      });
    }

    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      window.speechSynthesis.cancel();
    }

    console.log(
      'Emergency alarm sound stopped'
    );
  }

  /**
   * Sends an emergency notification to a buddy.
   *
   * This method is kept as a separate abstraction so it can later
   * be connected to FCM, push notifications, or another backend.
   */
  private async sendEmergencyNotification(
    buddy: {
      name: string;
      id: string;
    },
    alertMessage: string,
    location?: EmergencyLocation
  ): Promise<void> {
    try {
      console.log(
        `Sending emergency notification to buddy ${buddy.name}:`,
        {
          message: alertMessage,
          location
        }
      );

      // Notification delivery should normally be handled by
      // EmergencyService / Firebase Cloud Functions.
      //
      // Do not directly send push notifications from the
      // client if your notification infrastructure is server-side.

    } catch (error) {
      console.error(
        'Error sending notification to buddy:',
        buddy.name,
        error
      );
    }
  }

  /**
   * Creates/logs an emergency alert object.
   */
private async logEmergencyAlert(
  uid: string,
  alertType: EmergencyAlertTrigger,
  location: EmergencyLocation | undefined,
  emergencyData: EmergencyData | null | undefined,
  buddies: Buddy[],
  emergencyId: string
): Promise<void> {
  try {
    const alertLog = {
      id: emergencyId,
      uid,
      alertType,
      location,
      emergencyData: emergencyData ?? {},
      notifiedBuddies: buddies
        .map(
          buddy =>
            buddy.connectedUserId ||
            buddy.buddyUid ||
            buddy.id
        )
        .filter(
          (id): id is string =>
            typeof id === 'string' &&
            id.length > 0 &&
            id !== uid
        ),
      responderIds: [],
      timestamp: new Date(),
      status: 'active' as const
    };

    console.log(
      'Emergency alert logged:',
      alertLog
    );

  } catch (error) {
    console.error(
      'Error logging emergency alert:',
      error
    );
  }
}


  /**
   * Escapes text before inserting it into HTML.
   */
  private sanitizeText(
    input: string
  ): string {
    if (!input) {
      return '';
    }

    if (
      typeof document !== 'undefined'
    ) {
      const div =
        document.createElement('div');

      div.appendChild(
        document.createTextNode(input)
      );

      return div.innerHTML;
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Formats emergency instructions as HTML for display.
   */
  formatEmergencyInstructionForDisplay(
    emergencyData: EmergencyData
  ): string {
    const {
      emergencyInstructions,
      emergencyInstruction,
      name,
      allergies
    } = emergencyData;

    const safeName =
      this.sanitizeText(
        name || 'Unknown'
      );

    let display =
      `<div class="emergency-instruction-box">`;

    display +=
      `<h3>Emergency Instructions for ${safeName}</h3>`;

    
    // PER-ALLERGY INSTRUCTIONS
    

    if (
      emergencyInstructions &&
      emergencyInstructions.length > 0
    ) {
      display +=
        `<div class="emergency-instructions-list">`;

      emergencyInstructions.forEach(
        instruction => {
          const safeAllergyName =
            this.sanitizeText(
              instruction.allergyName
            );

          const safeInstruction =
            this.sanitizeText(
              instruction.instruction
            );

          display +=
            `<div class="instruction-item">`;

          display +=
            `<strong>${safeAllergyName}:</strong> ` +
            `${safeInstruction}`;

          display += `</div>`;
        }
      );

      display += `</div>`;

    
    // GENERAL INSTRUCTION
    

    } else if (emergencyInstruction) {
      const safeAllergies =
        allergies &&
        allergies.trim()
          ? this.sanitizeText(
              allergies
            )
          : null;

      const safeInstruction =
        this.sanitizeText(
          emergencyInstruction
        );

      if (
        safeAllergies &&
        safeAllergies.toLowerCase() !== 'none'
      ) {
        display +=
          `<p><strong>Allergies:</strong> ` +
          `${safeAllergies}</p>`;
      }

      display +=
        `<p><strong>Instructions:</strong> ` +
        `${safeInstruction}</p>`;

    
    // FALLBACK
    

    } else {
      display +=
        `<p><strong>Instructions:</strong> ` +
        `Use EpiPen immediately if available. ` +
        `Call emergency services.</p>`;
    }

    display += `</div>`;

    return display;
  }

  /**
   * Plays the configured emergency audio instructions.
   *
   * If an audio URL exists, it plays the audio file.
   * Otherwise, it falls back to text-to-speech.
   */
  async playAudioInstructions(
    emergencyData: EmergencyData
  ): Promise<void> {
    try {
      const currentUser =
        await this.authService.waitForAuthInit();

      if (currentUser) {
        const settings =
          await this.emergencySettingsService
            .getEmergencySettings(
              currentUser.uid
            );

        const audioEnabled =
          settings?.audioInstructions ?? true;

        if (!audioEnabled) {
          console.log(
            'Audio instructions disabled by user settings'
          );

          return;
        }
      }

      const audioUrl =
        emergencyData.emergencyMessage?.audioUrl;

      if (audioUrl) {
        if (
          typeof Audio === 'undefined'
        ) {
          throw new Error(
            'Audio playback is unavailable'
          );
        }

        const audio =
          new Audio(audioUrl);

        audio.preload = 'auto';

        await audio.play();

        console.log(
          'Playing audio emergency instructions'
        );

        return;
      }

      await this.speakInstructions(
        emergencyData
      );

    } catch (error) {
      console.error(
        'Error playing audio instructions:',
        error
      );

      await this.showToast(
        'Could not play audio instructions. Please read the on-screen instructions.',
        'warning'
      );
    }
  }

  /**
   * Speaks emergency instructions using native TTS
   * or browser speech synthesis.
   */
  private async speakInstructions(
    emergencyData: EmergencyData
  ): Promise<void> {
    try {
      const textToSpeak =
        this.buildEmergencyInstructionText(
          emergencyData
        );

      if (!textToSpeak.trim()) {
        console.warn(
          'No emergency instruction text available'
        );

        return;
      }

      // -------------------------------------------------------
      // NATIVE
      // -------------------------------------------------------

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

        console.log(
          'Speaking emergency instructions natively:',
          textToSpeak
        );

        return;
      }

      // -------------------------------------------------------
      // WEB
      // -------------------------------------------------------

      if (
        typeof window === 'undefined'
      ) {
        console.warn(
          'Text-to-speech unavailable: window is undefined'
        );

        return;
      }

      if (
        !('speechSynthesis' in window) ||
        typeof SpeechSynthesisUtterance ===
          'undefined'
      ) {
        console.warn(
          'Text-to-speech not supported on this device'
        );

        await this.showToast(
          'Text-to-speech not supported on this device',
          'warning'
        );

        return;
      }

      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(
          textToSpeak
        );

      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      utterance.volume = 1;
      utterance.pitch = 1;

      const voices =
        window.speechSynthesis.getVoices();

      const englishVoice =
        voices.find(
          voice =>
            voice.lang.startsWith('en') &&
            (
              voice.name.includes('Google') ||
              voice.name.includes('Microsoft')
            )
        ) ||
        voices.find(
          voice =>
            voice.lang.startsWith('en')
        );

      if (englishVoice) {
        utterance.voice =
          englishVoice;
      }

      window.speechSynthesis.speak(
        utterance
      );

      console.log(
        'Speaking emergency instructions:',
        textToSpeak
      );

    } catch (error) {
      console.error(
        'Error using text-to-speech:',
        error
      );
    }
  }

  /**
   * Builds the text used for emergency instructions.
   */
  private buildEmergencyInstructionText(
    emergencyData: EmergencyData
  ): string {
    const {
      emergencyInstructions,
      emergencyInstruction,
      emergencyMessage,
      name,
      allergies
    } = emergencyData;

    const patientName =
      name?.trim() || 'this person';

    
    // PER-ALLERGY INSTRUCTIONS
    

    if (
      Array.isArray(emergencyInstructions) &&
      emergencyInstructions.length > 0
    ) {
      const instructionText =
        emergencyInstructions
          .map(instruction => {
            const allergyName =
              instruction.allergyName?.trim() ||
              'Allergy';

            const instructionText =
              instruction.instruction?.trim() ||
              '';

            if (!instructionText) {
              return '';
            }

            return `${allergyName}: ${instructionText}`;
          })
          .filter(Boolean)
          .join('. ');

      if (instructionText) {
        return (
          `Emergency alert for ${patientName}. ` +
          `Emergency instructions: ` +
          `${instructionText}.`
        );
      }
    }

    
    // GENERAL EMERGENCY INSTRUCTION
    

    if (
      emergencyInstruction &&
      emergencyInstruction.trim()
    ) {
      let text =
        `Emergency alert for ${patientName}. `;

      if (
        allergies &&
        allergies.trim() &&
        allergies.trim().toLowerCase() !== 'none'
      ) {
        text +=
          `They are allergic to ${allergies}. `;
      }

      text +=
        emergencyInstruction.trim();

      return text;
    }

    
    // EMERGENCY MESSAGE
    

    if (
      emergencyMessage?.instructions &&
      emergencyMessage.instructions.trim()
    ) {
      let text =
        `Emergency alert for ${patientName}. `;

      if (
        allergies &&
        allergies.trim() &&
        allergies.trim().toLowerCase() !== 'none'
      ) {
        text +=
          `They are allergic to ${allergies}. `;
      }

      text +=
        emergencyMessage.instructions.trim();

      return text;
    }

    
    // FALLBACK
    

    let fallback =
      `Emergency alert for ${patientName}. `;

    if (
      allergies &&
      allergies.trim() &&
      allergies.trim().toLowerCase() !== 'none'
    ) {
      fallback +=
        `They are allergic to ${allergies}. `;
    }

    fallback +=
      'Call emergency services immediately.';

    return fallback;
  }

  /**
   * Displays an Ionic toast.
   */
  private async showToast(
    message: string,
    color: string = 'primary'
  ): Promise<void> {
    try {
      const toast =
        await this.toastController.create({
          message,
          duration: 3000,
          color,
          position: 'top'
        });

      await toast.present();

    } catch (error) {
      console.error(
        'Unable to display toast:',
        error
      );
    }
  }
}
