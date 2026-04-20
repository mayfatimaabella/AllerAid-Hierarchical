import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

export interface EmergencyInstructionEntry {
  label: string;
  text: string;
}

@Component({
  selector: 'app-emergency-details-modal',
  templateUrl: './emergency-details-modal.component.html',
  styleUrls: ['./emergency-details-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class EmergencyDetailsModalComponent implements OnInit {
  @Input() emergencyMessageName: string = '';
  @Input() userAllergies: any[] = [];
  @Input() instructionEntries: EmergencyInstructionEntry[] = [];
  @Input() emergencyLocation: string = '';
  @Input() emergencyContactName: string = '';
  @Input() emergencyContactPhone: string = '';
  @Input() dateOfBirth: string = '';
  @Input() bloodType: string = '';
  @Input() openEditEmergencyMessageModal?: () => void;
  @Input() openManageInstructionsModal?: () => void;

  @Output() close = new EventEmitter<void>();
  @Output() editInstruction = new EventEmitter<{ label: string; text: string }>();
  @Output() testAudio = new EventEmitter<void>();
  @Output() addInstruction = new EventEmitter<void>();
  @Output() openEditAllergies = new EventEmitter<void>();

  ngOnInit() {}

  get hasInstructionEntries(): boolean {
    return Array.isArray(this.instructionEntries) && this.instructionEntries.length > 0;
  }

  get hasSpecificInstructions(): boolean {
    return Array.isArray(this.instructionEntries) && 
           this.instructionEntries.some(entry => entry.label !== 'General');
  }

  get formattedDateOfBirth(): string {
    const rawValue = (this.dateOfBirth || '').trim();
    if (!rawValue) {
      return 'Not specified';
    }

    let dateValue: Date;
    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawValue);

    if (isoDateMatch) {
      const year = Number(isoDateMatch[1]);
      const monthIndex = Number(isoDateMatch[2]) - 1;
      const day = Number(isoDateMatch[3]);
      dateValue = new Date(year, monthIndex, day);
    } else {
      dateValue = new Date(rawValue);
    }

    if (isNaN(dateValue.getTime())) {
      return rawValue;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(dateValue);
  }

  onClose() { this.close.emit(); }
  onEditInstruction(label: string, text: string) { this.editInstruction.emit({ label, text }); }
  onTestAudio() { this.testAudio.emit(); }
  onAddInstruction() { this.addInstruction.emit(); }
  
  async handleOpenManageInstructionsModal() {
    // Close this modal first
    this.close.emit();
    // Wait a bit for modal to close
    await new Promise(resolve => setTimeout(resolve, 400));
    // Then open the manage instructions modal
    if (this.openManageInstructionsModal) {
      this.openManageInstructionsModal();
    }
  }
}
