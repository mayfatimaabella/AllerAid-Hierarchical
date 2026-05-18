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
  constructor(

  ) {}

  // Inputs from parent
  @Input() userAllergies: any[] = [];
  @Input() emergencyMessage: any = {};
  @Input() profileDetails: any = {};
  @Input() userProfile: UserProfile | null = null;
  @Input() openEditEmergencyMessageModal!: () => void;
  // UI state owned by this component


  // Events to parent
  @Output() openEditAllergies = new EventEmitter<void>();
  @Output() openEmergencyInfo = new EventEmitter<void>();

  @Output() shareInstruction = new EventEmitter<any>();

  // Inputs for the instructions modal
  @Input() emergencyInstructions: any[] = [];


  // Add this method to help Angular track changes
  trackByAllergyName(index: number, allergy: any): string {
    return allergy.name;
  }

  


  
  
}
