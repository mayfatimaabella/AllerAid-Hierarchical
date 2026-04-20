import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { EmergencyAlertService } from '../../../core/services/emergency-alert.service';
import { EmergencyDetectorService } from '../../../core/services/emergency-detector.service';
import { VoiceRecordingService } from '../../../core/services/voice-recording.service';

@Injectable({
  providedIn: 'root'
})
export class EmergencyTestingService {

  constructor(
    private emergencyAlertService: EmergencyAlertService,
    private emergencyDetectorService: EmergencyDetectorService,
    private voiceRecordingService: VoiceRecordingService,
    private alertController: AlertController
  ) {}

  /**
   * Test emergency alert system
   */
  async testEmergencyAlert(onComplete: (message: string) => void): Promise<void> {
    try {
      await this.emergencyAlertService.triggerEmergencyAlert('manual');
      onComplete('Emergency alert test sent successfully');
    } catch (error) {
      console.error('Error testing emergency alert:', error);
      onComplete('Error testing emergency alert');
    }
  }

  /**
   * Test shake detection
   */
  async testShakeDetection(
    shakeToAlertEnabled: boolean,
    onComplete: (message: string) => void
  ): Promise<void> {
    if (!shakeToAlertEnabled) {
      const alert = await this.alertController.create({
        header: 'Shake Detection Disabled',
        message: 'Please enable "Shake to Alert" setting first',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Test Shake Detection',
      message: 'This will simulate a shake gesture and trigger an emergency alert. Continue?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Test',
          handler: async () => {
            await this.emergencyDetectorService.testShakeDetection();
            onComplete('Shake detection test triggered');
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Test power button detection
   */
  async testPowerButtonDetection(
    powerButtonAlertEnabled: boolean,
    onComplete: (message: string) => void
  ): Promise<void> {
    if (!powerButtonAlertEnabled) {
      const alert = await this.alertController.create({
        header: 'Volume Button Alert Disabled',
        message: 'Please enable "Volume Button Alert" setting first',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Test Volume Button Detection',
      message: 'This will simulate a volume button triple-press and trigger an emergency alert. Continue?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Test',
          handler: async () => {
            await this.emergencyDetectorService.testPowerButtonDetection();
            onComplete('Power button detection test triggered');
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Test audio instructions
   */
  async testAudioInstructions(
    audioInstructionsEnabled: boolean,
    name: string,
    allergies: string,
    instructions: string,
    location: string,
    onComplete: (message: string) => void
  ): Promise<void> {
    if (!audioInstructionsEnabled) {
      const alert = await this.alertController.create({
        header: 'Audio Instructions Disabled',
        message: 'Please enable "Audio Instructions" setting first',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    try {
      const fullMessage = `Emergency alert for ${name}. Allergies: ${allergies}. Instructions: ${instructions}. Location: ${location}.`;
      await this.voiceRecordingService.playEmergencyInstructions(fullMessage);
      onComplete('Emergency audio message played');
    } catch (error) {
      console.error('Error testing audio instructions:', error);
      onComplete('Error testing audio instructions');
    }
  }

  /**
   * Request motion permissions for shake detection (iOS)
   */
  async requestMotionPermissions(onComplete: (granted: boolean, message: string) => void): Promise<void> {
    try {
      const granted = await this.emergencyDetectorService.requestMotionPermissions();
      onComplete(granted, granted ? 'Motion permissions granted' : 'Motion permissions denied');
    } catch (error) {
      console.error('Error requesting motion permissions:', error);
      onComplete(false, 'Error requesting motion permissions');
    }
  }
}
