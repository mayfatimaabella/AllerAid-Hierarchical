import { Injectable } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';

export interface VoiceRecording {
  id: string;
  name: string;
  duration: number;
  size: number;
  timestamp: Date;
  audioBlob: Blob;
  audioUrl: string;
}

export interface AudioSettings {
  useCustomVoice: boolean;
  selectedRecordingId: string | null;
  defaultVoice: 'male' | 'female';
  speechRate: number; // 0.5 to 2.0
  volume: number; // 0.0 to 1.0
}

@Injectable({
  providedIn: 'root'
})
export class VoiceRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private recordingTime = 0;
  private recordingTimer: any;

  // Recording state observables
  private recordingStateSubject = new BehaviorSubject<boolean>(false);
  private recordingTimeSubject = new BehaviorSubject<number>(0);
  private recordingsSubject = new BehaviorSubject<VoiceRecording[]>([]);

  public recordingState$ = this.recordingStateSubject.asObservable();
  public recordingTime$ = this.recordingTimeSubject.asObservable();
  public recordings$ = this.recordingsSubject.asObservable();

  private audioSettings: AudioSettings = {
    useCustomVoice: false,
    selectedRecordingId: null,
    defaultVoice: 'female',
    speechRate: 1.0,
    volume: 1.0
  };

  constructor(
    private toastController: ToastController,

  ) {
    this.loadRecordings();
    this.loadAudioSettings();
  }

  // Recording Management
  async startRecording(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType()
      });

      this.audioChunks = [];
      this.recordingTime = 0;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop();
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.recordingStateSubject.next(true);

      // Start timer
      this.recordingTimer = setInterval(() => {
        this.recordingTime++;
        this.recordingTimeSubject.next(this.recordingTime);
      }, 1000);

      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      await this.showToast('Failed to access microphone. Please check permissions.', 'danger');
      return false;
    }
  }

  async stopRecording(): Promise<VoiceRecording | null> {
    if (!this.mediaRecorder || !this.isRecording) {
      return null;
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const recording = this.handleRecordingStop();
        resolve(recording);
      };

      this.mediaRecorder!.stop();
      this.cleanup();
    });
  }

  private handleRecordingStop(): VoiceRecording | null {
    if (this.audioChunks.length === 0) {
      return null;
    }

    const audioBlob = new Blob(this.audioChunks, { type: this.getSupportedMimeType() });
    const audioUrl = URL.createObjectURL(audioBlob);

    const recording: VoiceRecording = {
      id: this.generateId(),
      name: `Recording ${new Date().toLocaleString()}`,
      duration: this.recordingTime,
      size: audioBlob.size,
      timestamp: new Date(),
      audioBlob: audioBlob,
      audioUrl: audioUrl
    };

    this.saveRecording(recording);
    this.cleanup();

    return recording;
  }

  private cleanup(): void {
    this.isRecording = false;
    this.recordingStateSubject.next(false);
    this.recordingTimeSubject.next(0);
    
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }

    if (this.mediaRecorder?.stream) {
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }

  // Recording Storage
  private saveRecording(recording: VoiceRecording): void {
    const recordings = this.getStoredRecordings();
    recordings.push(recording);
    
    // Convert blob to base64 for storage
    const reader = new FileReader();
    reader.onload = () => {
      const recordingData = {
        ...recording,
        audioData: reader.result as string,
        audioBlob: undefined // Remove blob from storage
      };
      
      localStorage.setItem('voice_recordings', JSON.stringify(recordings.map(r => 
        r.id === recording.id ? recordingData : r
      )));
      
      this.recordingsSubject.next(recordings);
    };
    reader.readAsDataURL(recording.audioBlob);
  }

  private loadRecordings(): void {
    const recordings = this.getStoredRecordings();
    this.recordingsSubject.next(recordings);
  }

  private getStoredRecordings(): VoiceRecording[] {
    try {
      const stored = localStorage.getItem('voice_recordings');
      if (!stored) return [];

      const data = JSON.parse(stored);
      return data.map((item: any) => {
        if (item.audioData) {
          // Convert base64 back to blob
          const byteCharacters = atob(item.audioData.split(',')[1]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: this.getSupportedMimeType() });
          
          return {
            ...item,
            audioBlob: blob,
            audioUrl: URL.createObjectURL(blob),
            timestamp: new Date(item.timestamp)
          };
        }
        return item;
      });
    } catch (error) {
      console.error('Failed to load recordings:', error);
      return [];
    }
  }

  // Recording Management
  async deleteRecording(recordingId: string): Promise<void> {
    const recordings = this.getStoredRecordings();
    const filtered = recordings.filter(r => r.id !== recordingId);
    
    localStorage.setItem('voice_recordings', JSON.stringify(filtered));
    this.recordingsSubject.next(filtered);

    // If this was the selected recording, clear it
    if (this.audioSettings.selectedRecordingId === recordingId) {
      this.audioSettings.selectedRecordingId = null;
      this.saveAudioSettings();
    }
  }

  async renameRecording(recordingId: string, newName: string): Promise<void> {
    const recordings = this.getStoredRecordings();
    const recording = recordings.find(r => r.id === recordingId);
    
    if (recording) {
      recording.name = newName;
      this.saveRecording(recording);
    }
  }

  // Audio Playback
  async playRecording(recordingId: string): Promise<void> {
    const recordings = this.recordingsSubject.value;
    const recording = recordings.find(r => r.id === recordingId);
    
    if (!recording) {
      await this.showToast('Recording not found', 'danger');
      return;
    }

    try {
      const audio = new Audio(recording.audioUrl);
      audio.volume = this.audioSettings.volume;
      audio.playbackRate = this.audioSettings.speechRate;
      
      await audio.play();
    } catch (error) {
      console.error('Failed to play recording:', error);
      await this.showToast('Failed to play recording', 'danger');
    }
  }

  async playEmergencyInstructions(instructions: string): Promise<void> {
    if (this.audioSettings.useCustomVoice && this.audioSettings.selectedRecordingId) {
      // Play custom recording
      await this.playRecording(this.audioSettings.selectedRecordingId);
    } else {
      // Use text-to-speech
      await this.speakText(instructions);
    }
  }

  private async speakText(text: string): Promise<void> {
    // Guard against environments (like some mobile WebViews) that
    // do not support the Web Speech API to avoid runtime errors.
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

    // Stop any ongoing speech before starting a new one
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Configure voice settings
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice =>
      voice.name.toLowerCase().includes(this.audioSettings.defaultVoice)
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = this.audioSettings.speechRate;
    utterance.volume = this.audioSettings.volume;

    window.speechSynthesis.speak(utterance);
  }

  // Audio Settings Management
  getAudioSettings(): AudioSettings {
    return { ...this.audioSettings };
  }

  updateAudioSettings(settings: Partial<AudioSettings>): void {
    this.audioSettings = { ...this.audioSettings, ...settings };
    this.saveAudioSettings();
  }

  private saveAudioSettings(): void {
    localStorage.setItem('audio_settings', JSON.stringify(this.audioSettings));
  }

  private loadAudioSettings(): void {
    try {
      const stored = localStorage.getItem('audio_settings');
      if (stored) {
        this.audioSettings = { ...this.audioSettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load audio settings:', error);
    }
  }

  // Utility Methods
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
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

  // Format duration for display
  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Format file size for display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
