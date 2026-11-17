
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
export class MedicationDetailsComponent implements OnInit, OnDestroy {

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

    // Listen for medication updates
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
    if (this.medSub) {
      this.medSub.unsubscribe();
    }
  }

  // --- UI Data Helpers ---

  getFormattedStartTime(): string {
    return this.medication?.startTime || '';
  }

  getUnitType(): string {
    const dosage = this.medication?.dosage?.toLowerCase() || '';

    if (dosage.includes('puff')) return 'puffs';
    if (dosage.includes('ml')) return 'ml';

    if (
      dosage.includes('mg') ||
      dosage.includes('tablet') ||
      dosage.includes('pill')
    ) {
      return 'tablets';
    }

    return 'units';
  }

  // Current available medication supply
  calculateRemainingPills(): number {
    if (!this.medication) return 0;

    const remainingValue =
      this.medication.refillsRemaining ??
      this.medication.initialStock ??
      this.medication.quantity ??
      0;

    const amount = Number(remainingValue);

    return Number.isFinite(amount)
      ? Math.max(Math.floor(amount), 0)
      : 0;
  }

  // Calculate supply progress percentage
  getSupplyPercentage(): number {
    if (!this.medication) return 0;

    const remaining = this.calculateRemainingPills();
    const required = Number(this.medication.quantity) || 0;

    if (required <= 0) return 0;

    return Math.min((remaining / required) * 100, 100);
  }

  // Check whether medication has a future start date and time
  isUpcoming(): boolean {
    if (!this.medication?.startDate) return false;

    const dateValue: any = this.medication.startDate;
    let startDate: Date;

    if (dateValue?.toDate) {
      startDate = dateValue.toDate();
    } else if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ) {
      const [year, month, day] = dateValue.split('-').map(Number);
      startDate = new Date(year, month - 1, day);
    } else {
      startDate = new Date(dateValue);
    }

    if (isNaN(startDate.getTime())) return false;

    const time = this.medication.startTime || '00:00';

    const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);

    if (match) {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const period = match[3]?.toUpperCase();

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      startDate.setHours(hours, minutes, 0, 0);
    }

    return startDate.getTime() > Date.now();
  }

  // --- Reactive Status Logic ---

  getStatusLabel(): string {
    if (!this.medication) return '';

    const remaining = this.calculateRemainingPills();

    if (remaining <= 0) return 'Completed';

    if (this.medication.status === 'Incomplete') {
      return 'Incomplete';
    }

    if (this.isUpcoming()) {
      return 'Upcoming';
    }

    if (this.medService.isOverdue(this.medication)) {
      return 'Overdue';
    }

    return this.medication.isActive ? 'Ongoing' : 'Inactive';
  }

  getStatusColor(): string {
    const label = this.getStatusLabel();

    switch (label) {
      case 'Ongoing':
      case 'Active':
        return 'success';

      case 'Upcoming':
        return 'tertiary';

      case 'Completed':
        return 'primary';

      case 'Overdue':
        return 'warning';

      case 'Incomplete':
      case 'Expired':
        return 'danger';

      default:
        return 'medium';
    }
  }

  // --- Action Handlers ---

  isEmergency(): boolean {
    return this.isEmergencyMedicationFn
      ? !!this.isEmergencyMedicationFn(this.medication)
      : false;
  }

  isExpiringSoon(): boolean {
    return this.isExpiringSoonFn
      ? !!this.isExpiringSoonFn(this.medication?.medicineExpiryDate)
      : false;
  }

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
            await this.router.navigate([
              '/tabs/medication/add-edit',
              target.id
            ]);
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

              this.showToast(
                'Medication deleted successfully!',
                'success'
              );

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

  private async showToast(
    message: string,
    color: string = 'primary'
  ): Promise<void> {
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
