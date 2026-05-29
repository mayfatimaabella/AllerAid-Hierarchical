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
import { IonicModule } from '@ionic/angular';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-profile-health-section',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './health-section.component.html',
  styleUrls: ['./health-section.component.scss']
})
export class HealthSectionComponent implements OnInit, OnDestroy {
  @Input() filteredMedications: Medication[] = [];
  @Input() medicationFilter: string = 'all';
  @Input() medicationSearchTerm = '';
  @Input() isLoading = false;

  // Internal state
  userMedications: Medication[] = [];
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

  constructor(private medService: MedicationService) {}

  ngOnInit() {
    // Subscribe to the source of truth in MedicationService
    this.medSub = this.medService.medications$.subscribe(meds => {
      this.userMedications = meds;
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

  getStatusLabel(medication: any): string {
  if (!medication) return '';

  const remaining = this.calculateRemainingPills(medication);
  
  // 1. NEW: Check if the end date has passed (Incomplete status)
  if (this.isPastEndDate(medication) && remaining > 0) {
    return 'Incomplete';
  }

  // 2. Existing Priority Logic
  if (this.medService.isExpired(medication)) return 'Expired';
  if (remaining <= 0) return 'Completed';
  if (this.medService.isOverdue(medication)) return 'Overdue';

  // 3. Fallback
  return medication.isActive ? 'Ongoing' : 'Inactive';
}

// Ensure this helper is present in this component as well
private isPastEndDate(medication: any): boolean {
  if (!medication || !medication.expiryDate) return false;

  const endDate = (medication.expiryDate.toDate && typeof medication.expiryDate.toDate === 'function')
    ? medication.expiryDate.toDate()
    : new Date(medication.expiryDate);

  if (isNaN(endDate.getTime())) return false;

  const now = new Date();
  endDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  return now > endDate;
}

  getStatusColor(medication: Medication): string {
    const label = this.getStatusLabel(medication);
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
    this.medicationFilterChange.emit(ev?.detail?.value || 'all');
  }

  //getToggleStatusLabel(medication: Medication): string {
   // return medication.isActive ? 'Mark as Inactive' : 'Mark as Active';
  //}

  isEmergencyMedication(med: Medication): boolean {
    return this.isEmergencyMedicationFn ? !!this.isEmergencyMedicationFn(med) : false;
  }
}