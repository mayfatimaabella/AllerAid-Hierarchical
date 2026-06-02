import { CommonModule } from '@angular/common';
import { 
  Component, 
  EventEmitter, 
  Input, 
  Output, 
  OnInit, 
  OnDestroy
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-medication',
  templateUrl: './medication.page.html',
  styleUrls: ['./medication.page.scss'],
  standalone: false,
})
export class MedicationPage implements OnInit {
  @Input() medicationFilter: string = 'all';
  @Input() medicationSearchTerm = '';
  @Input() isLoading = false;

  // Internal state
  userMedications: Medication[] = [];
  filteredMedications: Medication[] = [];
  private medSub?: Subscription;
  private refreshInterval: any;

  @Input() isEmergencyMedicationFn?: (m: any) => boolean;
  @Input() isExpiringSoonFn?: (date: any) => boolean;

  @Output() add = new EventEmitter<void>();
  @Output() search = new EventEmitter<CustomEvent>();
  @Output() clearSearch = new EventEmitter<void>();
  @Output() medicationFilterChange = new EventEmitter<string>();
  @Output() toggleStatus = new EventEmitter<any>();
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() viewImage = new EventEmitter<{ url: string; title: string }>();
  @Output() viewDetails = new EventEmitter<any>();

  trackByMedication = (i: number, m: any) => m?.id ?? i;

  constructor(
    private medService: MedicationService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe to the source of truth in MedicationService
    this.medSub = this.medService.medications$.subscribe(meds => {
      this.userMedications = meds;
      this.applyFilters();
    });

    // Initial data load
    this.medService.refreshMedications();

    // Periodic refresh for status/expiry/overdue calculations
    this.refreshInterval = setInterval(() => {
      this.medService.refreshMedications();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.medSub) this.medSub.unsubscribe();
  }

  getStatusLabel(medication: Medication): string {
    if (!medication) return '';

    const remaining = this.calculateRemainingPills(medication);
    
    if (this.medService.isExpired(medication)) return 'Expired';
    if (remaining <= 0) return 'Completed';
    
    // Uses the new Overdue logic from MedicationService
    if (this.medService.isOverdue(medication)) return 'Overdue';

    return medication.isActive ? 'Ongoing' : 'Inactive';
  }

  getStatusColor(medication: Medication): string {
    const label = this.getStatusLabel(medication);
    switch (label) {
      case 'Ongoing': return 'success';
      case 'Completed': return 'primary';
      case 'Overdue': return 'warning';
      case 'Expired': return 'danger';
      case 'Inactive': return 'medium';
      default: return 'medium';
    }
  }

  getUnitLabel(medication: Medication): string {
    const dosage = medication?.dosage?.toLowerCase() || '';
    if (dosage.includes('puff')) return 'puffs';
    if (dosage.includes('ml')) return 'mL';
    if (dosage.includes('mg') || dosage.includes('tablet')) return 'tablets';
    return 'pills';
  }

  getLowStockWarning(medication: Medication): string | null {
    const remaining = this.calculateRemainingPills(medication);
    const unit = this.getUnitLabel(medication);
    
    if (remaining > 0 && remaining < 5) {
      return `Low stock: ${Math.floor(remaining)} ${unit}`;
    }
    return null;
  }

  calculateRemainingPills(medication: Medication): number {
    if (!medication) return 0;
    const remainingValue = medication.refillsRemaining ?? medication.quantity ?? 0;
    return Math.max(Math.floor(Number(remainingValue)), 0);
  }

  onFilterChange(ev: any) {
    this.medicationFilter = ev?.detail?.value || 'all';
    this.medicationFilterChange.emit(this.medicationFilter);
    this.applyFilters();
  }

  isEmergencyMedication(med: Medication): boolean {
    return this.isEmergencyMedicationFn ? !!this.isEmergencyMedicationFn(med) : false;
  }

  /**
   * Applies both status filter and search term filter
   */
  private applyFilters(): void {
    let filtered = [...this.userMedications];

    // Apply status filter
    filtered = this.applyStatusFilter(filtered);

    // Apply search filter
    if (this.medicationSearchTerm && this.medicationSearchTerm.trim()) {
      const searchLower = this.medicationSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(med =>
        med.name.toLowerCase().includes(searchLower) ||
        med.brandName?.toLowerCase().includes(searchLower) ||
        med.dosage.toLowerCase().includes(searchLower) ||
        med.category.toLowerCase().includes(searchLower)
      );
    }

    this.filteredMedications = filtered;
  }

  /**
   * Filter medications by active/inactive/completed status
   */
  private applyStatusFilter(medications: Medication[]): Medication[] {
    if (this.medicationFilter === 'active') {
      return medications.filter(med => {
        const status = this.getStatusLabel(med);
        return med.isActive && status !== 'Completed' && status !== 'Expired' && status !== 'Inactive';
      });
    }

    if (this.medicationFilter === 'history') {
      return medications.filter(med => {
        const status = this.getStatusLabel(med);
        return !med.isActive || status === 'Completed' || status === 'Expired' || status === 'Inactive';
      });
    }

    // 'all' - return everything
    return medications;
  }

  /**
   * Called when user initiates a search
   */
  onSearch(event: any): void {
    this.medicationSearchTerm = event?.detail?.value || '';
    this.search.emit(event);
    this.applyFilters();
  }

  /**
   * Called when user clears the search
   */
  onClearSearch(): void {
    this.medicationSearchTerm = '';
    this.clearSearch.emit();
    this.applyFilters();
  }

  /**
   * Create new medication - navigate to add-edit page
   */
  async onAddMedication(): Promise<void> {
    await this.router.navigate(['/medication/add-edit']);
  }

  /**
   * View medication details - navigate to details page with medication ID
   */
  async onViewDetails(medication: Medication): Promise<void> {
    if (medication.id) {
      await this.router.navigate(['/medication/details', medication.id]);
    }
  }

  /**
   * Edit existing medication - navigate to add-edit page with medication ID
   */
  async onEditMedication(medication: Medication): Promise<void> {
    if (medication.id) {
      await this.router.navigate(['/medication/add-edit', medication.id]);
    }
  }

  /**
   * Delete medication with confirmation
   */
  async onDeleteMedication(medication: Medication, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }

    const alert = await this.alertCtrl.create({
      header: 'Delete Medication',
      message: `Are you sure you want to delete "${medication.name}"? This action cannot be undone.`,
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
              await this.medService.deleteMedication(medication.id!);
              this.showToast('Medication deleted successfully!', 'success');
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

  /**
   * Toggle medication active/inactive status
   */
  async onToggleStatus(medication: Medication, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    try {
      await this.medService.toggleMedicationStatus(medication.id!);
      const newStatus = medication.isActive ? 'Inactive' : 'Active';
      this.showToast(`Medication marked as ${newStatus}`, 'success');
    } catch (error) {
      console.error('Error toggling medication status:', error);
      this.showToast('Failed to update medication status', 'danger');
    }
  }

  /**
   * Show toast notification
   */
  private async showToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
