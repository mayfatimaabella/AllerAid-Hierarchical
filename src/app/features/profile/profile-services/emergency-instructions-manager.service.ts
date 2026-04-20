import { Injectable } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { MedicalService } from '../../../core/services/medical.service';
import { AlertController, ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class EmergencyInstructionsManagerService {

  emergencyInstructions: any[] = [];
  showManageInstructionsModal: boolean = false;
  showInstructionDetailsModal: boolean = false;
  editingInstruction: any = null;
  selectedInstructionDetails: any = null;
  selectedAllergyForInstruction: any = null;
  newInstructionText: string = '';
  userAllergies: any[] = [];
  manageInstructionsModal: any = null;

  constructor(
    private authService: AuthService,
    private medicalService: MedicalService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  /**
   * Load emergency instructions for the current user
   */
  async loadEmergencyInstructions(userProfile: any): Promise<void> {
    if (!userProfile) return;

    try {
      this.emergencyInstructions = await this.medicalService.getEmergencyInstructions(userProfile.uid);
    } catch (error) {
      console.error('Error loading emergency instructions:', error);
    }
  }

  /**
   * Open the manage instructions modal and reset state
   */
  openManageInstructionsModal(): void {
    this.showInstructionDetailsModal = false;
    this.selectedInstructionDetails = null;
    this.editingInstruction = null;

    if (this.manageInstructionsModal) {
      this.manageInstructionsModal.selectedAllergyForInstruction = null;
      this.manageInstructionsModal.newInstructionText = '';
    }

    this.showManageInstructionsModal = true;
  }

  /**
   * Close the manage instructions modal and reset all state
   */
  onManageInstructionsDismiss(): void {
    this.showManageInstructionsModal = false;
    this.showInstructionDetailsModal = false;
    this.selectedInstructionDetails = null;
    this.editingInstruction = null;
    this.selectedAllergyForInstruction = null;
    this.newInstructionText = '';

    if (this.manageInstructionsModal) {
      this.manageInstructionsModal.selectedAllergyForInstruction = null;
      this.manageInstructionsModal.newInstructionText = '';
    }
  }

  /**
   * Show details for a specific instruction
   */
  onShowDetails(instruction: any): void {
    if (!instruction) {
      this.showInstructionDetailsModal = false;
      this.selectedInstructionDetails = null;
      return;
    }

    this.selectedInstructionDetails = instruction;

    if (!this.showManageInstructionsModal) {
      this.showManageInstructionsModal = true;
    }

    // Force detail view to refresh
    this.showInstructionDetailsModal = false;
    setTimeout(() => {
      this.showInstructionDetailsModal = true;
    });
  }

  /**
   * Add a new emergency instruction for an allergy
   */
  async onAddInstruction(): Promise<void> {
    try {
      if (!this.manageInstructionsModal) {
        this.presentAlert('Modal not initialized.');
        return;
      }

      const selectedAllergy = this.manageInstructionsModal.selectedAllergyForInstruction;
      const instructionText = this.manageInstructionsModal.newInstructionText;

      if (!selectedAllergy) {
        this.presentAlert('Please select an allergy.');
        return;
      }

      if (!instructionText || !instructionText.trim()) {
        this.presentAlert('Please enter an instruction.');
        return;
      }

      const currentUser = await this.authService.getCurrentUser();
      if (!currentUser) {
        this.presentAlert('User not authenticated.');
        return;
      }

      const allergyId = selectedAllergy.id || selectedAllergy.allergyId || selectedAllergy.label || '';
      const allergyName = selectedAllergy.label || selectedAllergy.allergyName || '';

      if (!allergyId || !allergyName) {
        this.presentAlert('Invalid allergy selection. Please try again.');
        return;
      }

      // Check if instruction already exists for this allergy
      const existingInstruction = this.emergencyInstructions.find(
        inst => (inst.allergyId === allergyId) || (inst.allergyName === allergyName)
      );

      if (existingInstruction) {
        const alert = await this.alertController.create({
          header: 'Replace Existing Instruction?',
          message: `An instruction already exists for ${allergyName}:\n\n"${existingInstruction.instruction}"\n\nDo you want to replace it with the new instruction?`,
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel'
            },
            {
              text: 'Replace',
              role: 'confirm',
              handler: async () => {
                await this.saveInstruction(currentUser.uid, allergyId, allergyName, instructionText.trim());
              }
            }
          ]
        });

        await alert.present();
      } else {
        // No existing instruction, save directly
        await this.saveInstruction(currentUser.uid, allergyId, allergyName, instructionText.trim());
      }
    } catch (error) {
      console.error('Error adding instruction:', error);
      this.presentAlert('Failed to save instruction. Please try again.');
    }
  }

  /**
   * Helper method to save instruction and refresh
   */
  private async saveInstruction(uid: string, allergyId: string, allergyName: string, instructionText: string): Promise<void> {
    await this.medicalService.setEmergencyInstructionForAllergy(
      uid,
      allergyId,
      allergyName,
      instructionText
    );

    if (this.manageInstructionsModal) {
      this.manageInstructionsModal.selectedAllergyForInstruction = null;
      this.manageInstructionsModal.newInstructionText = '';
    }

    await this.loadEmergencyInstructions({ uid });
    await this.presentToast('Instruction saved successfully!');
  }

  /**
   * Update an existing emergency instruction
   */
  async onUpdateInstruction(): Promise<void> {
    try {
      if (!this.manageInstructionsModal) {
        this.presentAlert('Modal not initialized.');
        return;
      }

      const editingInstruction = this.editingInstruction;
      const instructionText = this.manageInstructionsModal.newInstructionText;

      if (!editingInstruction || !instructionText.trim()) {
        this.presentAlert('Please enter an instruction.');
        return;
      }

      const currentUser = await this.authService.getCurrentUser();
      if (!currentUser) {
        this.presentAlert('User not authenticated.');
        return;
      }

      await this.medicalService.setEmergencyInstructionForAllergy(
        currentUser.uid,
        editingInstruction.allergyId || editingInstruction.allergyName,
        editingInstruction.allergyName,
        instructionText.trim()
      );

      this.editingInstruction = null;
      this.manageInstructionsModal.selectedAllergyForInstruction = null;
      this.manageInstructionsModal.newInstructionText = '';

      await this.loadEmergencyInstructions({ uid: currentUser.uid });
    } catch (error) {
      console.error('Error updating instruction:', error);
      this.presentAlert('Failed to update instruction. Please try again.');
    }
  }

  /**
   * Remove an emergency instruction with confirmation
   */
  async onRemoveInstruction(idOrEvent: any): Promise<void> {
    try {
      let id: string | undefined;

      if (typeof idOrEvent === 'string') {
        id = idOrEvent;
      } else if (idOrEvent && idOrEvent.target && idOrEvent.target.value) {
        id = idOrEvent.target.value;
      }

      if (!id) {
        this.presentAlert('Unable to identify instruction to remove.');
        return;
      }

      const targetInstruction = this.emergencyInstructions?.find(
        instr => instr.allergyId === id || instr.allergyName === id
      );
      const label = targetInstruction?.allergyName || 'this allergy';

      const alert = await this.alertController.create({
        header: 'Delete instruction?',
        message: `This will remove the emergency instruction for ${label}.`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Delete',
            role: 'destructive',
            handler: async () => {
              const currentUser = await this.authService.getCurrentUser();
              if (!currentUser) {
                this.presentAlert('User not authenticated.');
                return;
              }
              await this.medicalService.removeEmergencyInstructionForAllergy(currentUser.uid, id!);
              await this.loadEmergencyInstructions({ uid: currentUser.uid });
            }
          }
        ]
      });

      await alert.present();
    } catch (error) {
      console.error('Error removing instruction:', error);
      this.presentAlert('Failed to remove instruction. Please try again.');
    }
  }

  /**
   * Enter edit mode for an instruction
   */
  onEditInstruction(instruction: any): void {
    if (!instruction) {
      return;
    }

    this.showInstructionDetailsModal = false;
    this.selectedInstructionDetails = null;

    const resolvedAllergy = this.userAllergies?.find(a =>
      a.id === instruction.allergyId ||
      a.allergyId === instruction.allergyId ||
      a.label === instruction.allergyName ||
      a.name === instruction.allergyName
    ) || {
      id: instruction.allergyId,
      allergyId: instruction.allergyId,
      label: instruction.allergyName,
      allergyName: instruction.allergyName
    };

    this.editingInstruction = instruction;
    this.selectedAllergyForInstruction = resolvedAllergy;
    this.newInstructionText = instruction.instruction || '';

    if (this.manageInstructionsModal) {
      this.manageInstructionsModal.selectedAllergyForInstruction = resolvedAllergy;
      this.manageInstructionsModal.newInstructionText = instruction.instruction || '';
    }
  }

  /**
   * Cancel editing mode and reset form
   */
  onCancelEdit(): void {
    this.editingInstruction = null;
    this.selectedAllergyForInstruction = null;
    this.newInstructionText = '';

    if (this.manageInstructionsModal) {
      this.manageInstructionsModal.selectedAllergyForInstruction = null;
      this.manageInstructionsModal.newInstructionText = '';
    }
  }

  /**
   * Helper: Check if emergency instructions list is empty
   */
  isEmergencyInstructionsEmpty(): boolean {
    return !this.emergencyInstructions || this.emergencyInstructions.length === 0;
  }

  /**
   * Helper: Present an alert
   */
  private presentAlert(message: string): void {
    window.alert(message);
  }

  /**
   * Helper: Present a toast notification
   */
  async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'medium'
    });
    await toast.present();
  }
}
