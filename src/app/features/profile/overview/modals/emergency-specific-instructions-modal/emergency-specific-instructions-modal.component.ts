import { Component, ViewChild } from '@angular/core';
import { ModalController, IonicModule, IonTextarea } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmergencyInstructionsManagerService } from '../../../profile-services/emergency-instructions-manager.service';

@Component({
  selector: 'app-emergency-specific-instructions-modal',
  templateUrl: './emergency-specific-instructions-modal.component.html',
  styleUrls: ['./emergency-specific-instructions-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class EmergencySpecificInstructionsModalComponent {
  get emergencyInstructions() { return this.emergencyInstructionsManager.emergencyInstructions; }
  get userAllergies() { return this.emergencyInstructionsManager.userAllergies; }
  get editingInstruction() { return this.emergencyInstructionsManager.editingInstruction; }

  selectedAllergyForInstruction: any = null;
  newInstructionText = '';

  @ViewChild('instructionTextarea') instructionTextarea?: IonTextarea;

  constructor(
    private modalCtrl: ModalController,
    public emergencyInstructionsManager: EmergencyInstructionsManagerService
  ) {
    this.emergencyInstructionsManager.manageInstructionsModal = this;
  }

  focusInstructionInput(): void {
    setTimeout(() => {
      this.instructionTextarea?.setFocus();
    }, 0);
  }

  async onSubmit(): Promise<void> {
    if (this.editingInstruction) {
      await this.emergencyInstructionsManager.onUpdateInstruction();
    } else {
      await this.emergencyInstructionsManager.onAddInstruction();
    }

    await this.onClose();
  }

  async onCancelEdit(): Promise<void> {
    this.emergencyInstructionsManager.onCancelEdit();
    await this.onClose();
  }

  onEditInstruction(instruction: any): void {
    this.emergencyInstructionsManager.onEditInstruction(instruction);
    this.focusInstructionInput();
  }

  async onRemoveInstruction(id: string): Promise<void> {
    await this.emergencyInstructionsManager.onRemoveInstruction(id);
  }

  async onClose(): Promise<void> {
    this.selectedAllergyForInstruction = null;
    this.newInstructionText = '';

    this.emergencyInstructionsManager.onManageInstructionsDismiss();

    await this.modalCtrl.dismiss();
  }
}