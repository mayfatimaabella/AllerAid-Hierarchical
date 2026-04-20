import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Medication } from '../../../core/services/medication.service';

@Component({
  selector: 'app-medication-list',
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>
          Medications
          <ion-button fill="clear" size="small" (click)="onAddMedication()">
            <ion-icon name="add"></ion-icon>
          </ion-button>
        </ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <!-- Filter buttons -->
        <ion-segment [(ngModel)]="currentFilter" (ionInput)="onFilterChange($event)">
          <ion-segment-button value="all">
            <ion-label>All ({{ medications.length }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="active">
            <ion-label>Active ({{ activeCount ?? getActiveMedicationsCount() }})</ion-label>
          </ion-segment-button>
          <ion-segment-button value="emergency">
            <ion-label>Emergency ({{ emergencyCount ?? getEmergencyMedicationsCount() }})</ion-label>
          </ion-segment-button>
        </ion-segment>

        <!-- Search bar -->
        <ion-searchbar 
          placeholder="Search medications..." 
          (ionInput)="onSearch($event)"
          debounce="300">
        </ion-searchbar>

        <!-- Medications list -->
        <div *ngFor="let medication of filteredMedications" class="medication-item">
          <ion-item>
            <div slot="start">
              <ion-chip [color]="getCategoryColor(medication.category)">
                {{ getCategoryLabel(medication.category) }}
              </ion-chip>
            </div>
            
            <ion-label>
              <h3>{{ medication.name }}</h3>
              <p>{{ medication.dosage }} - {{ medication.frequency }}</p>
              <p *ngIf="medication.prescribedBy">Prescribed by: {{ medication.prescribedBy }}</p>
            </ion-label>

            <div slot="end">
              <ion-button 
                fill="clear" 
                size="small" 
                [color]="medication.isActive ? 'success' : 'medium'"
                (click)="onToggleStatus(medication.id)">
                <ion-icon [name]="medication.isActive ? 'checkmark-circle' : 'pause-circle'"></ion-icon>
              </ion-button>
              
              <ion-button fill="clear" size="small" color="danger" (click)="onDelete(medication.id)">
                <ion-icon name="trash"></ion-icon>
              </ion-button>
            </div>
          </ion-item>

          <!-- Medication images -->
          <div *ngIf="medication.prescriptionImageUrl || medication.medicationImageUrl" class="medication-images">
            <ion-button 
              *ngIf="medication.prescriptionImageUrl" 
              fill="clear" 
              size="small"
              (click)="onViewImage(medication.prescriptionImageUrl, 'Prescription Image')">
              <ion-icon name="document-attach"></ion-icon>
              Prescription
            </ion-button>
            
            <ion-button 
              *ngIf="medication.medicationImageUrl" 
              fill="clear" 
              size="small"
              (click)="onViewImage(medication.medicationImageUrl, 'Medication Photo')">
              <ion-icon name="camera"></ion-icon>
              Photo
            </ion-button>
          </div>
        </div>

        <div *ngIf="filteredMedications.length === 0" class="no-medications">
          <ion-text color="medium">
            <p>No medications found</p>
          </ion-text>
        </div>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .medication-item {
      margin-bottom: 8px;
    }
    .medication-images {
      padding: 8px 16px;
      border-top: 1px solid var(--ion-color-light);
    }
    .no-medications {
      text-align: center;
      padding: 20px;
    }
  `]
})
export class MedicationListComponent {
  @Input() medications: Medication[] = [];
  @Input() filteredMedications: Medication[] = [];
  @Input() currentFilter: string = 'all';
  @Input() activeCount?: number;
  @Input() emergencyCount?: number;

  @Output() addMedication = new EventEmitter<void>();
  @Output() toggleStatus = new EventEmitter<string>();
  @Output() deleteMedication = new EventEmitter<string>();
  @Output() viewImage = new EventEmitter<{url: string, title: string}>();
  @Output() filterChange = new EventEmitter<string>();
  @Output() search = new EventEmitter<string>();

  onAddMedication() {
    this.addMedication.emit();
  }

  onToggleStatus(medicationId: string | undefined) {
    if (medicationId) {
      this.toggleStatus.emit(medicationId);
    }
  }

  onDelete(medicationId: string | undefined) {
    if (medicationId) {
      this.deleteMedication.emit(medicationId);
    }
  }

  onViewImage(url: string, title: string) {
    this.viewImage.emit({ url, title });
  }

  onFilterChange(event: any) {
    this.filterChange.emit(event.detail.value);
  }

  onSearch(event: any) {
    this.search.emit(event.target.value);
  }

  getActiveMedicationsCount(): number {
    return this.medications.filter(med => med.isActive).length;
  }

  getEmergencyMedicationsCount(): number {
    return this.medications.filter(med => 
      (med as any).emergencyMedication === true || 
      med.category === 'emergency' || 
      med.category === 'allergy'
    ).length;
  }

  getCategoryColor(category: string): string {
    switch (category) {
      case 'allergy':
      case 'emergency':
        return 'danger';
      case 'daily':
        return 'primary';
      case 'asNeeded':
        return 'warning';
      default:
        return 'medium';
    }
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case 'allergy':
        return 'Allergy';
      case 'emergency':
        return 'Emergency';
      case 'daily':
        return 'Daily';
      case 'asNeeded':
        return 'As Needed';
      default:
        return 'Other';
    }
  }
}







