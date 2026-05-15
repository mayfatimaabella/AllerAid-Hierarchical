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
// 1. Ensure this path matches where your service is located
import { MedicationService } from 'src/app/core/services/medication.service';

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

  // 2. INJECT medService HERE to fix the "red" error
  constructor(
    private cdr: ChangeDetectorRef,
    private medService: MedicationService
  ) {}

  ngOnInit() {
    this.refreshInterval = setInterval(() => {
      this.cdr.markForCheck();
    }, 60000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  getStatusLabel(medication: any): string {
    if (!medication) return '';

    const now = new Date();
    const remaining = this.calculateRemainingPills(medication);
    
    // 3. This will now work because of the constructor injection
    if (this.medService.isExpired(medication)) {
      return 'Expired';
    }
    
    if (remaining <= 0) return 'Completed';
    
    const endDate = medication.expiryDate ? new Date(medication.expiryDate) : null;
    if (endDate && now > endDate) return 'Incomplete';

    // Using medication.nextDose from your service
    if (medication.nextDose && now > new Date(medication.nextDose)) {
      return 'Overdue';
    }

    return medication.isActive ? 'Ongoing' : 'Inactive';
  }

  getStatusColor(medication: any): string {
    const label = this.getStatusLabel(medication);
    switch (label) {
      case 'Ongoing': return 'success';     // Green
      case 'Completed': return 'primary';    // Blue/Teal
      case 'Overdue': return 'warning';      // Orange
      case 'Incomplete': return 'danger';     // Red
      case 'Expired': return 'danger';        // Red (Safety first!)
      default: return 'medium';
    }
  }

  getUnitLabel(medication: any): string {
    const dosage = medication?.dosage?.toLowerCase() || '';
    if (dosage.includes('puff')) return 'puffs';
    if (dosage.includes('ml')) return 'mL';
    if (dosage.includes('mg') || dosage.includes('tablet')) return 'tablets';
    return 'pills';
  }

  getLowStockWarning(medication: any): string | null {
    const remaining = this.calculateRemainingPills(medication);
    const unit = this.getUnitLabel(medication);
    
    if (remaining > 0 && remaining < 5) {
      return `Low stock: ${Math.floor(remaining)} ${unit}`;
    }
    return null;
  }

  calculateRemainingPills(medication: any): number {
    if (!medication) return 0;
    const remainingValue = medication.refillsRemaining !== undefined 
      ? medication.refillsRemaining 
      : medication.quantity;

    if (remainingValue === undefined || remainingValue === null) return 0;
    const amount = Number(remainingValue);
    return isNaN(amount) ? 0 : Math.max(Math.floor(amount), 0);
  }

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