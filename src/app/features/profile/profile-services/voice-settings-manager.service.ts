import { Injectable } from '@angular/core';
import { VoiceRecordingService, AudioSettings } from '../../../core/services/voice-recording.service';
import { ToastController, AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class VoiceSettingsManagerService  {
 
  audioSettings: AudioSettings = { defaultVoice: 'female', speechRate: 1, volume: 1 };
  isRecording: boolean = false;
  recordingTime: number = 0;
  recordings: any[] = [];

  constructor(
    private voiceRecordingService: VoiceRecordingService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    this.initializeRecordings();
  }

  /**
   * Initialize recordings from voice recording service
   */
  private initializeRecordings(): void {
    this.voiceRecordingService.recordings$.subscribe((recordings: any[]) => {
      this.recordings = recordings;
    });

    this.voiceRecordingService.recordingState$.subscribe((state: boolean) => {
      this.isRecording = state;
    });

    this.voiceRecordingService.recordingTime$.subscribe((time: number) => {
      this.recordingTime = time;
    });

    this.audioSettings = this.voiceRecordingService.getAudioSettings();
  }

  /**
   * Start a new voice recording
   */
  async startRecording(): Promise<void> {
    const success = await this.voiceRecordingService.startRecording();
    if (success) {
      this.presentToast('Recording started. Speak clearly!');
      this.isRecording = true;
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording(): Promise<void> {
    const recording = await this.voiceRecordingService.stopRecording();
    if (recording) {
      this.presentToast('Recording saved successfully');

    }
  }

  /**
   * Play a recording by ID
   */
  async playRecording(id: string): Promise<void> {
    await this.voiceRecordingService.playRecording(id);
  }

  /**
   * Delete a recording with confirmation
   */
  async deleteRecording(recording: any): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete Recording',
      message: `Are you sure you want to delete "${recording.name}"?`,
      buttons: [
        {
          text: 'Delete', handler: async () => {
            await this.voiceRecordingService.deleteRecording(recording.id);
            this.presentToast('Recording deleted');
          }
        },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await alert.present();
  }

  /**
   * Handle audio settings change
   */
  onAudioSettingChange(): void {
    this.voiceRecordingService.updateAudioSettings(this.audioSettings);
  }

  /**
   * Format duration in seconds to mm:ss format
   */
  formatDuration(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  /**
   * Format file size in bytes to human-readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get CSS class for audio source indicator
   */
  getAudioSourceClass(): string {
    return 'audio-source default-voice';
  }

  /**
   * Get display text for current audio source
   */
  getAudioSourceText(): string {
    return `Text-to-Speech (${this.audioSettings.defaultVoice})`;
  }

  /**
   * Show a toast notification
   */
  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
