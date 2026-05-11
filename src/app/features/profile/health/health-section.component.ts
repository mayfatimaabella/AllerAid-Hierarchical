import { CommonModule } from '@angular/common';
import { 
  ChangeDetectionStrategy, 
  Component, 
  EventEmitter, 
  Input, 
  Output, 
  OnInit, 
  OnDestroy, 
  ChangeDetectorRef 
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-profile-health-section',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './health-section.component.html',
  styleUrls: ['./health-section.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HealthSectionComponent implements OnInit, OnDestroy {
  @Input() userMedications: any[] = [];
  @Input() filteredMedications: any[] = [];
  @Input() medicationFilter: string = 'all';
  @Input() medicationSearchTerm = '';
  @Input() isLoading = false;

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

  private refreshInterval: any;

  trackByMedication = (i: number, m: any) => m?.id ?? m?.name ?? i;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Refresh UI every minute to update "Pills Left" status if time-based logic is used
    this.refreshInterval = setInterval(() => {
      this.cdr.markForCheck();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  /**
   * Returns a user-friendly status label.
   * Logic: Finished > Expired > Active/Inactive
   */
  getStatusLabel(medication: any): string {
    if (!medication) return '';

    const remaining = this.calculateRemainingPills(medication);
    if (remaining <= 0) return 'Finished';
    
    const isExpired = medication.expiryDate && new Date(medication.expiryDate) < new Date();
    if (isExpired) return 'Expired';
    
    return medication.isActive ? 'Active' : 'Inactive';
  }

  /**
   * Maps the status to Ionic colors.
   * 'medium' (grey) is used for finished to reduce visual noise.
   */
  getStatusColor(medication: any): string {
    const label = this.getStatusLabel(medication);
    switch (label) {
      case 'Active': return 'success';
      case 'Finished': return 'medium';
      case 'Expired': return 'danger';
      default: return 'warning';
    }
  }

  /**
   * Determines the unit string for display.
   */
  getUnitLabel(medication: any): string {
    const dosage = medication?.dosage?.toLowerCase() || '';
    if (dosage.includes('puff')) return 'puffs';
    if (dosage.includes('ml')) return 'mL';
    if (dosage.includes('mg') || dosage.includes('tablet')) return 'tablets';
    return 'pills';
  }

  /**
   * Generates warning text if stock is between 1 and 4.
   */
  getLowStockWarning(medication: any): string | null {
    const remaining = this.calculateRemainingPills(medication);
    const unit = this.getUnitLabel(medication);
    
    if (remaining > 0 && remaining < 5) {
      return `Low stock: ${Math.floor(remaining)} ${unit}`;
    }
    return null;
  }

  /**
   * Standardizes the remaining pill count logic.
   */
  calculateRemainingPills(medication: any): number {
    if (!medication) return 0;

    const remainingValue = medication.refillsRemaining !== undefined 
      ? medication.refillsRemaining 
      : medication.quantity;

    if (remainingValue === undefined || remainingValue === null) {
      return 0;
    }

    const amount = Number(remainingValue);
    return isNaN(amount) ? 0 : Math.max(Math.floor(amount), 0);
  }

  /**
   * Emits the change when the user clicks 'All', 'Active', or 'Finished'.
   */
  onFilterChange(ev: any) {
    const value = ev?.detail?.value;
    this.medicationFilterChange.emit(value || 'all');
  }

  getToggleStatusLabel(medication: any): string {
    return medication.isActive ? 'Mark as Inactive' : 'Mark as Active';
  }

  isEmergencyMedication(med: any): boolean {
    return this.isEmergencyMedicationFn ? !!this.isEmergencyMedicationFn(med) : false;
  }
}