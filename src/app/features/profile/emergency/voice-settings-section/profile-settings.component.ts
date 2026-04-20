import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './profile-settings.component.html',
  styleUrls: ['./profile-settings.component.scss']
})
export class ProfileSettingsComponent {
  @Input() audioInstructionsEnabled = false;
  @Input() showVoiceSettings = false;
  @Input() profileVoiceFacade: any;
  @Input() testAudioSettings!: () => Promise<void>;
}
