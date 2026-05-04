import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ActionSheetController, IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-medication-details-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './medication-details.modal.html',
  styleUrls: ['./medication-details.modal.scss']
})
export class MedicationDetailsModal {
  @Input() medication: any;
  @Input() isEmergencyMedicationFn?: (m: any) => boolean;
  @Input() isExpiringSoonFn?: (date?: string) => boolean;
  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<string | undefined>();
  // Added an output to inform the parent component that the status changed
  @Output() statusChange = new EventEmitter<any>();

  constructor(private actionSheetController: ActionSheetController) {}

  /**
   * Checks if the physical medicine has expired (shelf-life).
   * This is used for the "Medicine Expiry" field in the UI.
   */
  isMedicineExpired(): boolean {
    if (!this.medication?.medicineExpiryDate) return false;
    const expiry = new Date(this.medication.medicineExpiryDate);
    return expiry < new Date();
  }

  getStatusLabel(): string {
    if (!this.medication) return '';

    // Treatment schedule expiry
    const isExpired = this.medication.expiryDate && new Date(this.medication.expiryDate) < new Date();
    if (isExpired) return 'Expired';

    const rawQuantity = typeof this.medication.quantity === 'number'
      ? this.medication.quantity
      : Number(this.medication.quantity);

    if (this.medication.isActive) {
      if (!isNaN(rawQuantity) && rawQuantity <= 0) {
        return 'Finished';
      }
      return 'Active';
    }

    return 'Inactive';
  }

  getStatusColor(): string {
    const label = this.getStatusLabel();
    return (label === 'Active') ? 'success' : 'danger';
  }

  calculateRemainingPills(): number {
    const med = this.medication;
    if (med?.quantity === undefined || med?.quantity === null) {
      return 0;
    }

    const quantity = Number(med.quantity);
    if (isNaN(quantity)) {
      return 0;
    }

    return Math.max(Math.floor(quantity), 0);
  }

  // --- Existing Helpers ---

  isEmergency(): boolean {
    return this.isEmergencyMedicationFn ? !!this.isEmergencyMedicationFn(this.medication) : false;
  }

  isExpiringSoon(): boolean {
    return this.isExpiringSoonFn ? !!this.isExpiringSoonFn(this.medication?.expiryDate) : false;
  }

  async presentMedicationActions(medication?: any): Promise<void> {
    const med = medication || this.medication;
    if (!med?.id) {
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: med.name || 'Medication',
      buttons: [
        {
          text: 'Edit Medication',
          icon: 'create-outline',
          handler: () => {
            this.edit.emit(med);
          }
        },
        // ADDED: Deactivate/Activate Toggle
        {
          text: med.isActive ? 'Deactivate Medication' : 'Activate Medication',
          icon: med.isActive ? 'pause-circle-outline' : 'play-circle-outline',
          handler: () => {
            this.toggleStatus(med);
          }
        },
        {
          text: 'Delete Medication',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => {
            this.delete.emit(med.id);
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close-outline'
        }
      ]
    });

    await actionSheet.present();
  }

  // Added logic to handle the deactivation
  private toggleStatus(med: any) {
    med.isActive = !med.isActive;
    this.statusChange.emit(med);
  }
}