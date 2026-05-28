import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UserProfile } from '../../../core/services/models/user-profile.model';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-profile-overview-section',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './overview-section.component.html',
  styleUrls: ['./overview-section.component.scss']
})
export class OverviewSectionComponent {

  constructor() {}

  // Inputs from parent
  @Input() userAllergies: any[] = [];
  @Input() emergencyMessage: any = {};
  @Input() profileDetails: any = {};
  @Input() userProfile: UserProfile | null = null;
  @Input() openEditEmergencyMessageModal!: () => void;

  // Events to parent
  @Output() openEditAllergies = new EventEmitter<void>();
  @Output() openEmergencyInfo = new EventEmitter<void>();
  @Output() shareInstruction = new EventEmitter<any>();

  // Instructions
  @Input() emergencyInstructions: any[] = [];

  trackByAllergyName(index: number, allergy: any): string {
    return allergy.name;
  }

  /**
   * Strict PH mobile number formatter
   * Format: 09XXXXXXXXX
   */
  get formattedPhone(): string {

    if (!this.profileDetails?.phone) {
      return '';
    }

    // Remove all non-numeric characters
    let phone = String(this.profileDetails.phone).replace(/\D/g, '');

    // Convert +639XXXXXXXXX -> 09XXXXXXXXX
    if (phone.startsWith('639')) {
      phone = '0' + phone.substring(2);
    }

    // Strict validation
    const isValid = /^09\d{9}$/.test(phone);

    return isValid ? phone : '';
  }

  get hasValidPhone(): boolean {
    return !!this.formattedPhone;
  }
}