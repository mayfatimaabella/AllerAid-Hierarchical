import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { ActionSheetController, IonicModule } from '@ionic/angular';
// 1. Ensure the import path matches your project structure
import { MedicationService } from 'src/app/core/services/medication.service';

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

  // 2. Inject MedicationService here to fix potential "red" errors
  constructor(
    private actionSheetController: ActionSheetController,
    private medService: MedicationService
  ) {}

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
   * Determines the status of the medication (Ongoing, Completed, Expired, etc.).
   */
  getStatusLabel(): string {
    if (!this.medication) return '';

    const now = new Date();
    const remaining = this.calculateRemainingPills(); 
    
    // 3. Use the centralized service helper for physical expiry
    if (this.medService.isExpired(this.medication)) {
      return 'Expired';
    }

    // 4. Check for Completion (All pills taken)
    if (!isNaN(remaining) && remaining <= 0) {
      return 'Completed';
    }

    // 5. Check for Incomplete (Treatment duration over but pills left)
    const endDate = this.medication.expiryDate ? new Date(this.medication.expiryDate) : null;
    if (endDate && now > endDate) {
      return 'Incomplete';
    }

    // 6. Check for Overdue (Missed schedule)
    // Note: nextDose is the standard property name we've used in the Health Section
    if (this.medication.nextDose && new Date(this.medication.nextDose) < now) {
      return 'Overdue';
    }

    // 7. Standard State
    return this.medication.isActive ? 'Ongoing' : 'Inactive';
  }

  getStatusColor(): string {
    const label = this.getStatusLabel();
    switch (label) {
      case 'Ongoing': return 'success';     // Green
      case 'Completed': return 'primary';    // Blue/Teal
      case 'Overdue': return 'warning';      // Orange
      case 'Incomplete': return 'danger';     // Red
      case 'Expired': return 'danger';        // Red
      default: return 'medium';               // Grey
    }
  }

  /**
   * Simplified using the service helper
   */
  isMedicineExpired(): boolean {
    return this.medService.isExpired(this.medication);
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