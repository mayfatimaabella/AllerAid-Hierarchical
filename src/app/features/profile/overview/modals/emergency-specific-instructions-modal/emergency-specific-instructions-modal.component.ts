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
  // State is owned by EmergencyInstructionsManagerService; component acts as a view
  get emergencyInstructions() { return this.emergencyInstructionsManager.emergencyInstructions; }
  get userAllergies() { return this.emergencyInstructionsManager.userAllergies; }
  get editingInstruction() { return this.emergencyInstructionsManager.editingInstruction; }
  get selectedInstructionDetails() { return this.emergencyInstructionsManager.selectedInstructionDetails; }
  get showInstructionDetailsModal() { return this.emergencyInstructionsManager.showInstructionDetailsModal; }

  // Form state: NOT @Input to allow proper ngModel binding
  selectedAllergyForInstruction: any = null;
  newInstructionText: string = '';

  @ViewChild('instructionTextarea') instructionTextarea?: IonTextarea;
  constructor(
    private modalCtrl: ModalController,
    public emergencyInstructionsManager: EmergencyInstructionsManagerService
  ) {
    // Share form state with manager so its actions can read/update
    this.emergencyInstructionsManager.manageInstructionsModal = this;
  }

  focusInstructionInput(): void {
    // Defer to allow view to update before focusing
    setTimeout(() => {
      this.instructionTextarea?.setFocus();
    }, 0);
  }

  onSubmit() { if (this.editingInstruction) { this.emergencyInstructionsManager.onUpdateInstruction(); } else { this.emergencyInstructionsManager.onAddInstruction(); } }
  onCancelEdit() { this.emergencyInstructionsManager.onCancelEdit(); }
  onEditInstruction(instruction: any) { 
    this.emergencyInstructionsManager.onEditInstruction(instruction);
    this.focusInstructionInput();
  }
  onRemoveInstruction(id: string) { this.emergencyInstructionsManager.onRemoveInstruction(id); }
  onShowDetails(instruction: any) { this.emergencyInstructionsManager.onShowDetails(instruction); }
  onClose() { this.emergencyInstructionsManager.onManageInstructionsDismiss(); this.modalCtrl.dismiss(); }
}
