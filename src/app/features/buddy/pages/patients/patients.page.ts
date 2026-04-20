import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

interface Patient {
  id: string;
  fullName: string;
  relationship: string;
  avatar?: string;
  lastSeen: Date;
  hasActiveAllergies: boolean;
  allergyCount: number;
  phone?: string;
}

@Component({
  selector: 'app-patients',
  templateUrl: './patients.page.html',
  styleUrls: ['./patients.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class PatientsPage implements OnInit {
  patients: Patient[] = [];
  filteredPatients: Patient[] = [];
  searchTerm: string = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) { }

  async ngOnInit() {
    await this.loadPatients();
  }

  private async loadPatients() {
    try {
      const user = await this.authService.waitForAuthInit();
      if (user) {
        // Load patients this buddy is monitoring
        // This would get patients from accepted buddy relationships
        this.patients = [];
        this.filteredPatients = [...this.patients];
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  }

  filterPatients() {
    if (!this.searchTerm.trim()) {
      this.filteredPatients = [...this.patients];
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredPatients = this.patients.filter(patient =>
      patient.fullName.toLowerCase().includes(term) ||
      patient.relationship.toLowerCase().includes(term)
    );
  }

  clearSearch() {
    this.searchTerm = '';
    this.filterPatients();
  }

  async refreshPatients() {
    await this.loadPatients();
  }

  viewPatientDetails(patient: Patient) {
    // Navigate to patient details page with emergency info
    this.router.navigate(['/patient-details', patient.id]);
  }

  quickCall(patient: Patient, event: Event) {
    event.stopPropagation();
    if (patient.phone) {
      window.open(`tel:${patient.phone}`, '_system');
    }
  }

  checkInvitations() {
    this.router.navigate(['/tabs/buddy']);
  }

  viewEmergencyHistory() {
    this.router.navigate(['/tabs/emergencies']);
  }

  getStatusColor(lastSeen: Date): string {
    const now = new Date();
    const diffHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) return 'success';
    if (diffHours < 24) return 'warning';
    return 'medium';
  }

  getLastSeenText(lastSeen: Date): string {
    const now = new Date();
    const diffHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) return 'Active';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }
}
