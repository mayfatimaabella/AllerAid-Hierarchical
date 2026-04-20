import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-emergency-info-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './emergency-info-modal.component.html',
  styleUrls: ['./emergency-info-modal.component.scss'],
})
export class EmergencyInfoModalComponent {
  @Input() patientName: string = 'Patient';
  @Input() instructions: string = '';
  @Input() allergies: Array<{ label?: string; name?: string; value?: string }> = [];

  constructor(private modalController: ModalController) {}

  get hasInstructions(): boolean {
    return typeof this.instructions === 'string' && this.instructions.trim().length > 0;
  }

  get hasAllergies(): boolean {
    return Array.isArray(this.allergies) && this.allergies.length > 0;
  }

  getAllergyLabel(allergy: { label?: string; name?: string; value?: string }): string {
    const base = (allergy.label || allergy.name || '').trim();
    const value = (allergy.value || '').trim();
    if (base && value) return `${base} - ${value}`;
    return base || value || 'Allergy';
  }

  close() {
    return this.modalController.dismiss();
  }
}

