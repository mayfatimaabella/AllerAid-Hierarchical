import { Injectable, OnInit } from '@angular/core';
import { VoiceRecordingService, AudioSettings } from '../../../core/services/voice-recording.service';
import { ToastController, AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class VoiceSettingsManagerService implements OnInit {
  // State properties
  audioSettings: AudioSettings = { useCustomVoice: false, defaultVoice: 'female', speechRate: 1, volume: 1, selectedRecordingId: null };
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

  ngOnInit(): void {
    this.initializeRecordings();
  }

  /**
   * Initialize recordings from voice recording service
   */
  private initializeRecordings(): void {
    this.voiceRecordingService.recordings$.subscribe((recordings: any[]) => {
      this.recordings = recordings;
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
      this.isRecording = false;
      this.recordings.push(recording);
    }
  }

  /**
   * Play a recording by ID
   */
  async playRecording(id: string): Promise<void> {
    await this.voiceRecordingService.playRecording(id);
  }

  /**
   * Select a recording as custom voice
   */
  selectRecording(id: string): void {
    this.audioSettings.selectedRecordingId = id;
    this.audioSettings.useCustomVoice = true;
    this.voiceRecordingService.updateAudioSettings(this.audioSettings);
    this.presentToast('Custom voice selected');
  }

  /**
   * Delete a recording with confirmation
   */
  async deleteRecording(recording: any): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete Recording',
      message: `Are you sure you want to delete "${recording.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete', handler: async () => {
            await this.voiceRecordingService.deleteRecording(recording.id);
            this.presentToast('Recording deleted');
            this.recordings = this.recordings.filter(r => r.id !== recording.id);
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Check if a recording is selected as custom voice
   */
  isRecordingSelected(id: string): boolean {
    return this.audioSettings.selectedRecordingId === id;
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
    if (this.audioSettings.useCustomVoice && this.audioSettings.selectedRecordingId) {
      return 'audio-source custom-voice';
    }
    return 'audio-source default-voice';
  }

  /**
   * Get display text for current audio source
   */
  getAudioSourceText(): string {
    if (this.audioSettings.useCustomVoice && this.audioSettings.selectedRecordingId) {
      return 'Custom Voice';
    }
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
