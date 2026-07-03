import { Component, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [IonicModule, CommonModule, FormsModule]
})
export class EmergencySettingsCardComponent {
  @Input() emergencySettings: EmergencySettings = {} as EmergencySettings;
  @Input() getAudioSourceClass!: () => string;
  @Input() getAudioSourceText!: () => string;
  @Input() saveEmergencySettings!: () => void;
}