import { Component, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileSettingsComponent } from './voice-settings-section/profile-settings.component';

export interface EmergencySettings {
  shakeToAlert: boolean;
  powerButtonAlert: boolean;
  audioInstructions: boolean;
  [key: string]: any;
}

@Component({
  selector: 'app-emergency-settings-card',
  templateUrl: './emergency-settings-card.component.html',
  styleUrls: ['./emergency-settings-card.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, ProfileSettingsComponent]
})
export class EmergencySettingsCardComponent {
  @Input() emergencySettings: EmergencySettings = {} as EmergencySettings;
  @Input() showVoiceSettings: boolean = false;
  @Input() profileVoiceFacade: any;
  @Input() getAudioSourceClass!: () => string;
  @Input() getAudioSourceText!: () => string;
  @Input() openVoiceRecordingModal!: () => void;
  @Input() saveEmergencySettings!: () => void;
  @Input() testAudioSettings!: () => Promise<void>;

  testWatchConnection(): void {
    console.log('Testing smartwatch connection...');
    // TODO: Implement smartwatch connection test logic
  }
}
