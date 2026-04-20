import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
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
export class HealthSectionComponent {
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

  trackByMedication = (i: number, m: any) => m?.id ?? m?.name ?? i;

  constructor() {}

  /* Helper to get status label */
  getStatusLabel(medication: any): string {
    const isExpired = medication.expiryDate && new Date(medication.expiryDate) < new Date();
    if (isExpired) return 'Expired';
    
    const remaining = this.calculateRemainingPills(medication);
    if (remaining <= 0) return 'Finished';
    
    return medication.isActive ? 'Active' : 'Inactive';
  }

  /* Helper to get status color */
  getStatusColor(medication: any): string {
    const label = this.getStatusLabel(medication);
    return (label === 'Active') ? 'success' : 'danger';
  }

  /**
   * FEATURE: Low Stock Alert
   * Returns a warning string if remaining pills are > 0 but < 5.
   */
  getLowStockWarning(medication: any): string | null {
    const remaining = this.calculateRemainingPills(medication);
    
    // We only show a warning if it's not finished yet
    if (remaining > 0 && remaining < 5) {
      return `Low stock: ${Math.floor(remaining)} left`;
    }
    return null;
  }

  /**
   * FEATURE: Dose Reminder Helper
   * Parses frequency for reminder logic or UI display.
   */
  getDosesPerDay(medication: any): number {
    let dosesPerDay = 1;
    if (typeof medication.frequency === 'string') {
      const freq = medication.frequency.toLowerCase();
      const match = freq.match(/(\d+)/);
      if (match) {
        dosesPerDay = parseInt(match[1], 10);
      } else if (freq.includes('twice')) {
        dosesPerDay = 2;
      } else if (freq.includes('thrice')) {
        dosesPerDay = 3;
      }
    }
    return dosesPerDay;
  }

  /* Logic for calculating pills */
  calculateRemainingPills(medication: any): number {
    if (medication?.quantity === undefined || medication?.quantity === null) {
      return 0;
    }

    const quantity = Number(medication.quantity);
    if (isNaN(quantity)) {
      return 0;
    }

    return Math.max(Math.floor(quantity), 0);
  }

  onFilterChange(ev: CustomEvent) {
    const value = (ev as any)?.detail?.value;
    this.medicationFilterChange.emit(typeof value === 'string' ? value : 'all');
  }

  getToggleStatusLabel(medication: any): string {
    return medication.isActive ? 'Mark as Inactive' : 'Mark as Active';
  }

  isEmergencyMedication(med: any): boolean {
    return this.isEmergencyMedicationFn ? !!this.isEmergencyMedicationFn(med) : false;
  }
}