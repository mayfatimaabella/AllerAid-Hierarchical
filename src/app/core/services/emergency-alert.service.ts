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
  alertType: 'shake' | 'power-button' | 'manual' | 'buddy-request';
  status: 'active' | 'resolved' | 'cancelled';
  emergencyData: any;
  notifiedBuddies: string[];
  responderIds: string[];
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
  ) { }

  /**
   * Trigger emergency alert
   */
  async triggerEmergencyAlert(
  alertType: 'shake' | 'power-button' | 'manual' = 'manual'
): Promise<void> {
  try {
    const currentUser = await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    console.log(`Triggering ${alertType} emergency alert for user:`, currentUser.uid);

    const userProfile = await this.userService.getUserProfile(currentUser.uid);

    const fullNameParts: string[] = [];

    if (userProfile?.firstName) {
      fullNameParts.push(userProfile.firstName);
    }

    if (userProfile?.lastName) {
      fullNameParts.push(userProfile.lastName);
    }

    const derivedName = fullNameParts.join(' ').trim();

    const userName =
      (userProfile?.fullName || derivedName || currentUser.email || 'User').trim();

    const medicalData = await this.medicalService.getEmergencyData(currentUser.uid);
    const resolvedInstruction = medicalData?.emergencyInstruction?.trim() || '';

    const buddies = await this.buddyService.getUserBuddies(currentUser.uid);

    const buddyIds = Array.from(
      new Set(
        buddies
          .map(buddy => buddy.connectedUserId || buddy.buddyUid || buddy.id)
          .filter(id => !!id && id !== currentUser.uid)
      )
    );

    if (buddyIds.length === 0) {
      console.warn(
        'No emergency buddies configured. Emergency will use hotline-only fallback.'
      );
    }

    console.log('Getting current location before sending emergency alert...');

    let locationData: {
      latitude: number;
      longitude: number;
      accuracy?: number;
    };

    try {
      const position = await this.emergencyService.getCurrentLocation();

      locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
    } catch (error) {
      console.warn('Emergency alert blocked because location is unavailable:', error);

      await this.showToast(
        'Could not get your current location. Emergency alert was not sent.',
        'danger'
      );

      throw new Error('Location is required before sending an emergency alert.');
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

    console.log('Emergency alert sent successfully via EmergencyService');

  } catch (error) {
    console.error('Error triggering emergency alert:', error);
    throw error;
  }
}
  /**
   * Get current device location
   */
  private async getCurrentLocation(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation not supported');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          console.warn('Error getting location:', error);
          resolve(null); // Don't fail the alert if location fails
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  /**
   * Send emergency notification to a buddy
   */
  private async sendEmergencyNotification(buddy: any, alertMessage: string, location?: any): Promise<void> {
    try {
      // Here you would integrate with your notification service
      // For now, we'll log the notification
      console.log(`Sending emergency notification to buddy ${buddy.name}:`, alertMessage);
      
    } catch (error) {
      console.error('Error sending notification to buddy:', buddy.name, error);
    }
  }

  /**
   * Log emergency alert to database
   */
  private async logEmergencyAlert(
    uid: string, 
    alertType: string, 
    location: any, 
    emergencyData: any, 
    buddies: any[]
  ): Promise<void> {
    try {
      // Here you would save the alert to a dedicated emergency alerts collection
      const alertLog = {
        uid,
        alertType,
        location,
        emergencyData,
        notifiedBuddies: buddies.map(b => b.id),
        timestamp: new Date(),
        status: 'active'
      };
      
      console.log('Emergency alert logged:', alertLog);
      // TODO: Save to Firestore emergency alerts collection
      
    } catch (error) {
      console.error('Error logging emergency alert:', error);
    }
  }

  /**
   * Format emergency instruction for display
   */
  formatEmergencyInstructionForDisplay(emergencyData: any): string {
    const { emergencyInstructions, generalInstruction, emergencyProfile, name, allergies } = emergencyData;
    
    let display = `<div class="emergency-instruction-box">`;
    display += `<h3>Emergency Instructions for ${name}</h3>`;
    
    // Use structured emergency instructions if available
    if (emergencyInstructions && emergencyInstructions.length > 0) {
      display += `<div class="emergency-instructions-list">`;
      emergencyInstructions.forEach((instruction: any) => {
        display += `<div class="instruction-item">`;
        display += `<strong>${instruction.allergyName}:</strong> ${instruction.instruction}`;
        display += `</div>`;
      });
      display += `</div>`;
    }
    // Fallback to legacy single instruction
    else if (generalInstruction) {
      if (allergies && allergies !== 'None') {
        display += `<p><strong>Allergies:</strong> ${allergies}</p>`;
      }
      display += `<p><strong>Instructions:</strong> ${generalInstruction}</p>`;
    }

    // Basic fallback
    else {
      display += `<p><strong>Instructions:</strong> Use EpiPen immediately if available. Call 911.</p>`;
    }
    
    display += `</div>`;
    return display;
  }

  /**
   * Play audio emergency instructions (if available and enabled)
   */
  async playAudioInstructions(emergencyData: any): Promise<void> {
    try {
      // Check if audio instructions are enabled for this user
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
        // Use text-to-speech as fallback
        await this.speakInstructions(emergencyData);
      }
    } catch (error) {
      console.error('Error playing audio instructions:', error);
    }
  }

  /**
   * Use text-to-speech for emergency instructions
   */
  private async speakInstructions(emergencyData: any): Promise<void> {
    try {
      // Ensure Web Speech API is actually available before using it.
      if (typeof window === 'undefined') {
        console.warn('Text-to-speech not available: window is undefined');
        return;
      }

      const hasSpeechSynthesis = 'speechSynthesis' in window;
      const hasUtteranceConstructor = typeof SpeechSynthesisUtterance !== 'undefined';

      if (hasSpeechSynthesis && hasUtteranceConstructor) {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();
        
        const { emergencyInstructions, emergencyInstruction, emergencyMessage, name, allergies } = emergencyData;
        
        let textToSpeak = '';
        
        // Priority 1: Use structured emergency instructions if available
        if (emergencyInstructions && emergencyInstructions.length > 0) {
          textToSpeak = `Emergency alert for ${name || 'this person'}. Emergency instructions: `;
          emergencyInstructions.forEach((instruction: any, index: number) => {
            textToSpeak += `${instruction.allergyName}: ${instruction.instruction}. `;
          });
        }
        // Priority 2: Use saved emergency instruction if available
        else if (emergencyInstruction) {
          textToSpeak = emergencyInstruction;
        } 
        // Priority 3: Construct from emergency message
        else if (emergencyMessage?.instructions) {
          textToSpeak = `Emergency alert for ${name || 'this person'}. `;
          
          if (allergies && allergies !== 'None') {
            textToSpeak += `They are allergic to ${allergies}. `;
          }
          
          textToSpeak += emergencyMessage.instructions;
        }
        // Priority 4: Basic fallback message
        else {
          textToSpeak = `Emergency alert for ${name || 'this person'}. `;
          
          if (allergies && allergies !== 'None') {
            textToSpeak += `They are allergic to ${allergies}. Call emergency services immediately.`;
          } else {
            textToSpeak += 'Call emergency services immediately.';
          }
        }
        
        // Create speech utterance with optimized settings
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = 0.8; // Slightly slower for clarity in emergency
        utterance.volume = 1.0; // Maximum volume
        utterance.pitch = 1.0; // Normal pitch
        
        // Try to use a clear English voice
        const voices = window.speechSynthesis.getVoices();
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Google') || voice.name.includes('Microsoft'))
        ) || voices.find(voice => voice.lang.startsWith('en'));
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
        
        // Speak the emergency instructions
        window.speechSynthesis.speak(utterance);
        
        console.log('Speaking emergency instructions:', textToSpeak);
      } else {
        console.warn('Text-to-speech not supported on this device');
        await this.showToast('Text-to-speech not supported on this device', 'warning');
      }
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

