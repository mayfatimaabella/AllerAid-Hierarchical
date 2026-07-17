import { Component, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileSettingsComponent } from './voice-settings-section/profile-settings.component';

export interface EmergencySettings {
  shakeToAlert: boolean;
  volumeButtonAlert: boolean;
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
  @Input() getAudioSourceClass!: () => string;
  @Input() getAudioSourceText!: () => string;
  @Input() saveEmergencySettings!: () => void;
  @Input() profileVoiceFacade: any = null;
  @Input() testAudioSettings: () => Promise<void> = async () => undefined;
}