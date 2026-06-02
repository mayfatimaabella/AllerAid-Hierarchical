import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ActionSheetController, IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';

@Component({
  selector: 'app-medication-details',
  templateUrl: './medication-details.component.html',
  styleUrls: ['./medication-details.component.scss'],
  standalone: false,
})
export class MedicationDetailsComponent  implements OnInit {
  
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
    private route: ActivatedRoute,
    private router: Router,
    private actionSheetController: ActionSheetController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private medService: MedicationService
  ) {}

  ngOnInit() {
    // Get medication ID from route params and load it
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.loadMedication(params['id']);
      }
    });

    // Reactive: Listen to service for updates so the page reflects 
    // changes (like pill counts) made in real-time.
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

  private async loadMedication(medicationId: string): Promise<void> {
    try {
      const meds = await this.medService.getUserMedications();
      this.medication = meds.find(m => m.id === medicationId)!;
      
      if (!this.medication) {
        this.showToast('Medication not found', 'warning');
        this.router.navigate(['/tabs/medication']);
      }
    } catch (error) {
      console.error('Error loading medication:', error);
      this.showToast('Error loading medication', 'danger');
      this.router.navigate(['/tabs/medication']);
    }
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

    const remaining = this.calculateRemainingPills(); 
    
    // 1. Priority Checks via Service
    if (this.medService.isExpired(this.medication)) return 'Expired';
    if (remaining <= 0) return 'Completed';
    if (this.medService.isOverdue(this.medication)) return 'Overdue';

    // 2. Database Statuses
    if (this.medication.status === 'Incomplete') return 'Incomplete';
    if (this.medication.status === 'Ongoing' || this.medication.status === 'Active') return this.medication.status;

    return this.medication.isActive ? 'Ongoing' : 'Inactive';
  }

  getStatusColor(): string {
    const label = this.getStatusLabel();
    switch (label) {
      case 'Ongoing': 
      case 'Active': return 'success';
      case 'Completed': return 'primary';
      case 'Overdue': return 'warning';
      case 'Incomplete': 
      case 'Expired': return 'danger';
      default: return 'medium';
    }
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
        handler: async () => { 
          await this.router.navigate(['/medication/add-edit', target.id]);
        }
      },
      {
        text: 'Delete',
        role: 'destructive',
        icon: 'trash-outline',
        handler: async () => { 
          await this.confirmDelete(target.id!);
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

private async confirmDelete(medicationId: string): Promise<void> {
  const alert = await this.alertCtrl.create({
    header: 'Delete Medication',
    message: `Are you sure you want to delete "${this.medication.name}"? This action cannot be undone.`,
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Delete',
        role: 'destructive',
        handler: async () => {
          try {
            await this.medService.deleteMedication(medicationId);
            this.showToast('Medication deleted successfully!', 'success');
            await this.router.navigate(['/tabs/medication']);
          } catch (error) {
            console.error('Error deleting medication:', error);
            this.showToast('Failed to delete medication', 'danger');
          }
        }
      }
    ]
  });
  
  await alert.present();
}

private async showToast(message: string, color: string = 'primary'): Promise<void> {
  const toast = await this.toastCtrl.create({
    message,
    duration: 2000,
    position: 'bottom',
    color
  });
  await toast.present();
}

  toggleStatus() {
    if (this.medication.id) {
      this.medService.toggleMedicationStatus(this.medication.id);
    }
  }

  goBack(): void {
    this.router.navigate(['/tabs/medication']);
  }
}
