import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { VoiceRecordingService, VoiceRecording, AudioSettings } from '../../../core/services/voice-recording.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-voice-recording-modal',
  templateUrl: './voice-recording-modal.component.html',
  styleUrls: ['./voice-recording-modal.component.scss']
})
export class VoiceRecordingModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Output() dismiss = new EventEmitter<void>();

  recordings: VoiceRecording[] = [];
  audioSettings: AudioSettings;
  isRecording = false;
  recordingTime = 0;
  activeTab = 'recordings'; // 'recordings' | 'record' | 'settings'

  private subscriptions: Subscription[] = [];

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private voiceRecordingService: VoiceRecordingService
  ) {
    this.audioSettings = this.voiceRecordingService.getAudioSettings();
  }

  ngOnInit() {
    // Subscribe to recordings
    this.subscriptions.push(
      this.voiceRecordingService.recordings$.subscribe((recordings: VoiceRecording[]) => {
        this.recordings = recordings;
      })
    );

    // Subscribe to recording state
    this.subscriptions.push(
      this.voiceRecordingService.recordingState$.subscribe((isRecording: boolean) => {
        this.isRecording = isRecording;
      })
    );

    // Subscribe to recording time
    this.subscriptions.push(
      this.voiceRecordingService.recordingTime$.subscribe((time: number) => {
        this.recordingTime = time;
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  closeModal() {
    this.dismiss.emit();
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  // Recording Functions
  async startRecording() {
    const success = await this.voiceRecordingService.startRecording();
    if (success) {
      this.setActiveTab('record');
    }
  }

  async stopRecording() {
    const recording = await this.voiceRecordingService.stopRecording();
    if (recording) {
      this.setActiveTab('recordings');
    }
  }

  async playRecording(recordingId: string) {
    await this.voiceRecordingService.playRecording(recordingId);
  }

  async deleteRecording(recording: VoiceRecording) {
    const alert = await this.alertController.create({
      header: 'Delete Recording',
      message: `Are you sure you want to delete "${recording.name}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: async () => {
            await this.voiceRecordingService.deleteRecording(recording.id);
          }
        }
      ]
    });

    await alert.present();
  }

  async renameRecording(recording: VoiceRecording) {
    const alert = await this.alertController.create({
      header: 'Rename Recording',
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: recording.name,
          placeholder: 'Enter new name'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Rename',
          handler: async (data) => {
            if (data.name && data.name.trim()) {
              await this.voiceRecordingService.renameRecording(recording.id, data.name.trim());
            }
          }
        }
      ]
    });

    await alert.present();
  }

  selectRecording(recordingId: string) {
    this.audioSettings.selectedRecordingId = recordingId;
    this.audioSettings.useCustomVoice = true;
    this.voiceRecordingService.updateAudioSettings(this.audioSettings);
  }

  // Settings Functions
  onSettingChange() {
    this.voiceRecordingService.updateAudioSettings(this.audioSettings);
  }

  async testCurrentSettings() {
    const testMessage = "This is a test of your emergency audio instructions. Your settings have been applied.";
    await this.voiceRecordingService.playEmergencyInstructions(testMessage);
  }

  // Utility Functions
  formatDuration(seconds: number): string {
    return this.voiceRecordingService.formatDuration(seconds);
  }

  formatFileSize(bytes: number): string {
    return this.voiceRecordingService.formatFileSize(bytes);
  }

  getSelectedRecordingName(): string {
    if (!this.audioSettings.selectedRecordingId) {
      return 'None selected';
    }
    
    const recording = this.recordings.find(r => r.id === this.audioSettings.selectedRecordingId);
    return recording ? recording.name : 'Recording not found';
  }

  isRecordingSelected(recordingId: string): boolean {
    return this.audioSettings.selectedRecordingId === recordingId;
  }
}
