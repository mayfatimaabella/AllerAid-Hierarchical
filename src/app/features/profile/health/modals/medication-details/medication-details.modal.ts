import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { ActionSheetController, IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs'; // 1. Added Subscription
import { MedicationService, Medication } from 'src/app/core/services/medication.service';

@Component({
  selector: 'app-medication-details-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './medication-details.modal.html',
  styleUrls: ['./medication-details.modal.scss']
})
export class MedicationDetailsModal implements OnInit, OnDestroy {
  @Input() medication: any;
  @Input() isEmergencyMedicationFn?: (m: any) => boolean;
  @Input() isExpiringSoonFn?: (date?: string) => boolean;

  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<string | undefined>();
  @Output() statusChange = new EventEmitter<any>();
  @Output() viewImage = new EventEmitter<string>(); 

  private medSub: Subscription = new Subscription(); // 2. Tracking the subscription

  constructor(
    private actionSheetController: ActionSheetController,
    private medService: MedicationService
  ) {}

  // 3. Lifecycle hooks to handle real-time updates
  ngOnInit() {
    this.medSub = this.medService.medications$.subscribe(meds => {
      if (this.medication && this.medication.id) {
        const updatedMed = meds.find(m => m.id === this.medication.id);
        if (updatedMed) {
          this.medication = updatedMed;
        }
      }
    });
    // Trigger an initial refresh to ensure we have the absolute latest data
    this.medService.refreshMedications();
  }

  ngOnDestroy() {
    if (this.medSub) this.medSub.unsubscribe();
  }

  getFormattedStartTime(): string {
    return this.medication?.startTime || '';
  }

  getUnitType(): string {
    const dosage = this.medication?.dosage?.toLowerCase() || '';
    if (dosage.includes('puff')) return 'puffs';
    if (dosage.includes('ml')) return 'ml';
    if (dosage.includes('mg') || dosage.includes('tablet') || dosage.includes('pill')) return 'tablets';
    return 'units'; 
  }

  calculateRemainingPills(): number {
    const med = this.medication;
    if (!med) return 0;

    // Use refillsRemaining if available, otherwise fallback to quantity
    const remainingValue = med.refillsRemaining !== undefined ? med.refillsRemaining : med.quantity;

    if (remainingValue === undefined || remainingValue === null) {
      return 0;
    }

    const amount = Number(remainingValue);
    return isNaN(amount) ? 0 : Math.max(Math.floor(amount), 0);
  }

  getStatusLabel(): string {
    if (!this.medication) return '';

    const now = new Date();
    const remaining = this.calculateRemainingPills(); 
    
    if (this.medService.isExpired(this.medication)) {
      return 'Expired';
    }

    if (!isNaN(remaining) && remaining <= 0) {
      return 'Completed';
    }

    if (this.medication.status === 'Ongoing' || this.medication.status === 'Active') {
      return this.medication.status;
    }

    if (this.medication.status === 'Incomplete') {
      return 'Incomplete';
    }

    const endDate = this.medication.expiryDate ? new Date(this.medication.expiryDate) : null;
    if (endDate && now > endDate) {
      return 'Incomplete';
    }

    if (this.medication.nextDose && new Date(this.medication.nextDose) < now) {
      return 'Overdue';
    }

    return this.medication.isActive ? 'Ongoing' : 'Inactive';
  }

  getStatusColor(): string {
    const label = this.getStatusLabel();
    switch (label) {
      case 'Ongoing': return 'success';
      case 'Active': return 'success';
      case 'Completed': return 'primary';
      case 'Overdue': return 'warning';
      case 'Incomplete': return 'danger';
      case 'Expired': return 'danger';
      default: return 'medium';
    }
  }

  isMedicineExpired(): boolean {
    return this.medService.isExpired(this.medication);
  }

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