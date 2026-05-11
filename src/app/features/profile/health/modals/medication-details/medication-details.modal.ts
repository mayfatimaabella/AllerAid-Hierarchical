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
  @Output() viewImage = new EventEmitter<string>(); 

  constructor(private actionSheetController: ActionSheetController) {}

  /**
   * Helper to retrieve the Start Time for display beside the date.
   */
  getFormattedStartTime(): string {
    return this.medication?.startTime || '';
  }

  /**
   * Returns a friendly unit label for the supply tracker.
   */
  getUnitType(): string {
    const dosage = this.medication?.dosage?.toLowerCase() || '';
    if (dosage.includes('puff')) return 'puffs';
    if (dosage.includes('ml')) return 'ml';
    if (dosage.includes('mg') || dosage.includes('tablet') || dosage.includes('pill')) return 'tablets';
    return 'units'; 
  }

  /**
   * Calculates the remaining supply based on quantity and refills.
   */
  calculateRemainingPills(): number {
    const med = this.medication;
    if (!med) return 0;

    const remainingValue = med.refillsRemaining !== undefined ? med.refillsRemaining : med.quantity;

    if (remainingValue === undefined || remainingValue === null) {
      return 0;
    }

    const amount = Number(remainingValue);
    return isNaN(amount) ? 0 : Math.max(Math.floor(amount), 0);
  }

  /**
   * Determines the status of the medication (Active, Finished, or Expired).
   */
  getStatusLabel(): string {
    if (!this.medication) return '';

    const currentInventory = this.calculateRemainingPills();
    if (!isNaN(currentInventory) && currentInventory <= 0) {
      return 'Finished';
    }

    const isExpired = this.medication.expiryDate && new Date(this.medication.expiryDate) < new Date();
    if (isExpired) return 'Expired';

    return this.medication.isActive ? 'Active' : 'Inactive';
  }

  getStatusColor(): string {
    const label = this.getStatusLabel();
    switch (label) {
      case 'Active': return 'success';
      case 'Finished':
      case 'Expired': return 'danger';
      default: return 'medium';
    }
  }

  /**
   * Checks if the medicine shelf-life date has passed.
   */
  isMedicineExpired(): boolean {
    if (!this.medication?.medicineExpiryDate) return false;
    const expiry = new Date(this.medication.medicineExpiryDate);
    return expiry < new Date();
  }

  isEmergency(): boolean {
    return this.isEmergencyMedicationFn ? !!this.isEmergencyMedicationFn(this.medication) : false;
  }

  isExpiringSoon(): boolean {
    return this.isExpiringSoonFn ? !!this.isExpiringSoonFn(this.medication?.expiryDate) : false;
  }

  /**
   * Displays the action sheet for editing, toggling, or deleting.
   */
  async presentMedicationActions(medication?: any): Promise<void> {
    const med = medication || this.medication;
    if (!med?.id) return;

    const actionSheet = await this.actionSheetController.create({
      header: med.name || 'Medication Options',
      buttons: [
        {
          text: 'Edit Medication',
          icon: 'create-outline',
          handler: () => { this.edit.emit(med); }
        },
        {
          text: med.isActive ? 'Deactivate' : 'Activate',
          icon: med.isActive ? 'pause-circle-outline' : 'play-circle-outline',
          handler: () => { this.toggleStatus(med); }
        },
        {
          text: 'Delete',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => { this.delete.emit(med.id); }
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