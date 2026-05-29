import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { ActionSheetController, IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';

@Component({
  selector: 'app-medication-details-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './medication-details.modal.html',
  styleUrls: ['./medication-details.modal.scss']
})
export class MedicationDetailsModal implements OnInit, OnDestroy {
  @Input() medication!: Medication;
  @Input() isEmergencyMedicationFn?: (m: any) => boolean;
  @Input() isExpiringSoonFn?: (date?: string) => boolean;

  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<string | undefined>();
  @Output() statusChange = new EventEmitter<any>();
  @Output() viewImage = new EventEmitter<string>(); 

  private medSub: Subscription = new Subscription();

  constructor(
    private actionSheetController: ActionSheetController,
    private medService: MedicationService
  ) {}

  ngOnInit() {
    // Reactive: Listen to service for updates so the modal reflects 
    // changes (like pill counts) made in the Notification tab in real-time.
    this.medSub = this.medService.medications$.subscribe(meds => {
      if (this.medication && this.medication.id) {
        const updatedMed = meds.find(m => m.id === this.medication.id);
        if (updatedMed) {
          this.medication = updatedMed;
        }
      }
    });
    
    // Initial data refresh
    this.medService.refreshMedications();
  }

  ngOnDestroy() {
    if (this.medSub) this.medSub.unsubscribe();
  }

  // --- UI Data Helpers ---

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
    if (!this.medication) return 0;
    const remainingValue = this.medication.refillsRemaining ?? this.medication.quantity ?? 0;
    const amount = Number(remainingValue);
    return isNaN(amount) ? 0 : Math.max(Math.floor(amount), 0);
  }

  // --- Reactive Status Logic ---

  getStatusLabel(): string {
  if (!this.medication) return '';

  // 1. Calculate states
  const remaining = this.calculateRemainingPills();
  const isPastEndDate = this.isPastEndDate(this.medication); 
  
  // 2. Priority Logic
  // A. Incomplete: End date passed AND pills remain
  if (isPastEndDate && remaining > 0) return 'Incomplete';
  
  // B. Expired: Shelf life reached (from your medService)
  if (this.medService.isExpired(this.medication)) return 'Expired';
  
  // C. Completed: No pills left
  if (remaining <= 0) return 'Completed';
  
  // D. Overdue: Missed dose logic
  if (this.medService.isOverdue(this.medication)) return 'Overdue';

  // 3. Database Statuses fallback
  if (this.medication.status === 'Incomplete') return 'Incomplete';
  if (this.medication.status === 'Ongoing' || this.medication.status === 'Active') 
    return this.medication.status;

  return this.medication.isActive ? 'Ongoing' : 'Inactive';
}

// Helper method to safely handle the date comparison
private isPastEndDate(medication: any): boolean {
  // Check if expiryDate is defined and is not null/undefined
  if (!medication || !medication.expiryDate) return false;

  // Handle Firebase Timestamps or standard string dates
  const endDate = medication.expiryDate.toDate 
    ? medication.expiryDate.toDate() 
    : new Date(medication.expiryDate);

  // Guard against invalid date objects
  if (isNaN(endDate.getTime())) return false;

  const now = new Date();
  // We compare only the date (ignore time) to avoid false "past" flags on the final day
  endDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  return now > endDate;
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

  getStatusCaption(label: string): string {
  const captions: { [key: string]: string } = {
    'Overdue': 'You missed a scheduled dose.',
    'Incomplete': 'You didn\'t finish the medication on time.',
    'Completed': 'You have successfully finished the medication.',
    'Expired': 'This medication has reached its shelf life expiry.',
    'Ongoing': 'You are currently taking this medication.'
  };
  return captions[label] || '';
}

  // --- Action Handlers ---

  isMedicineExpired(): boolean {
    return this.medService.isExpired(this.medication);
  }

  isEmergency(): boolean {
    return this.isEmergencyMedicationFn ? !!this.isEmergencyMedicationFn(this.medication) : false;
  }

  isExpiringSoon(): boolean {
    return this.isExpiringSoonFn ? !!this.isExpiringSoonFn(this.medication?.medicineExpiryDate) : false;
  }

  // Update this method in medication-details.modal.ts
// Ensure this specific signature is in your medication-details.modal.ts
async presentMedicationActions(medication?: Medication): Promise<void> {
  const target = medication || this.medication;
  if (!target?.id) return;

  const actionSheet = await this.actionSheetController.create({
    header: target.name || 'Medication Options',
    buttons: [
      {
        text: 'Edit Medication',
        icon: 'create-outline',
        handler: () => { this.edit.emit(target); }
      },
      {
        text: 'Delete',
        role: 'destructive',
        icon: 'trash-outline',
        handler: () => { this.delete.emit(target.id); }
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

  toggleStatus() {
    if (this.medication.id) {
      this.medService.toggleMedicationStatus(this.medication.id);
    }
  }
}