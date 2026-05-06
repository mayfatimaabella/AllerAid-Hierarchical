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
  @Output() statusChange = new EventEmitter<any>();

  constructor(private actionSheetController: ActionSheetController) {}

  /**
   * Checks if the physical medicine has expired (shelf-life).
   */
  isMedicineExpired(): boolean {
    if (!this.medication?.medicineExpiryDate) return false;
    const expiry = new Date(this.medication.medicineExpiryDate);
    return expiry < new Date();
  }

  /**
   * Returns the current status label of the medication.
   * Logic: If refillsRemaining is 0, it is 'Finished'.
   */
  getStatusLabel(): string {
    if (!this.medication) return '';

    // 1. Check for treatment schedule expiry (End Date)
    const isExpired = this.medication.expiryDate && new Date(this.medication.expiryDate) < new Date();
    if (isExpired) return 'Expired';

    // 2. Check current inventory (Live count)
    const currentInventory = Number(this.medication.refillsRemaining ?? this.medication.quantity);

    if (this.medication.isActive) {
      if (!isNaN(currentInventory) && currentInventory <= 0) {
        return 'Finished';
      }
      return 'Active';
    }

    return 'Inactive';
  }
  getUnitType(): string {
  const dosage = this.medication?.dosage?.toLowerCase() || '';
  if (dosage.includes('puff')) return 'Puffs';
  if (dosage.includes('ml')) return 'Amount (mL)';
  if (dosage.includes('mg')) return 'Supply';
  return 'Inventory'; // Fallback if it's not clear
}

  getStatusColor(): string {
    const label = this.getStatusLabel();
    return (label === 'Active') ? 'success' : 'danger';
  }

  /**
   * This is the critical fix for your "Stuck at 18" issue.
   * It prioritizes the 'refillsRemaining' value which holds the deducted count.
   */
  calculateRemainingPills(): number {
    const med = this.medication;
    if (!med) return 0;

    // Use refillsRemaining (the live deducted count) first
    const remainingValue = med.refillsRemaining !== undefined ? med.refillsRemaining : med.quantity;

    if (remainingValue === undefined || remainingValue === null) {
      return 0;
    }

    const amount = Number(remainingValue);
    return isNaN(amount) ? 0 : Math.max(Math.floor(amount), 0);
  }

  // --- Helpers ---

  isEmergency(): boolean {
    return this.isEmergencyMedicationFn ? !!this.isEmergencyMedicationFn(this.medication) : false;
  }

  isExpiringSoon(): boolean {
    return this.isExpiringSoonFn ? !!this.isExpiringSoonFn(this.medication?.expiryDate) : false;
  }

  async presentMedicationActions(medication?: any): Promise<void> {
    const med = medication || this.medication;
    if (!med?.id) return;

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

  private toggleStatus(med: any) {
    med.isActive = !med.isActive;
    this.statusChange.emit(med);
  }
}