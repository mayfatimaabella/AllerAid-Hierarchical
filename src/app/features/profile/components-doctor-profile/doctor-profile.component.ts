import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { AccessRequest } from '../../../core/services/ehr.service';
import {
  Activity,
  DoctorStats,
  ProfessionalCredential,
  ProfessionalSettings,
} from '../profile.types';

@Component({
  selector: 'app-doctor-profile',
  templateUrl: './doctor-profile.component.html',
  styleUrls: ['./doctor-profile.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class DoctorProfileComponent implements OnInit {
  @Input() userProfile: any;
  @Input() doctorStats: DoctorStats = {
    activePatients: 0,
    pendingRequests: 0,
    recentConsultations: 0,
    criticalPatients: 0,
    highRiskPatients: 0,
    upcomingAppointments: 0
  };
  @Input() pendingRequests: AccessRequest[] = [];
  @Input() professionalSettings: ProfessionalSettings = {
    accessRequestNotifications: true,
    patientUpdateNotifications: true,
    emergencyAlerts: true,
    workingHours: '9:00 AM - 5:00 PM',
    contactPreference: 'Email'
  };
  @Input() recentActivity: Activity[] = [];
  @Input() professionalCredentials: ProfessionalCredential[] = [];

  @Output() navigateToDashboard = new EventEmitter<void>();
  @Output() acceptRequest = new EventEmitter<AccessRequest>();
  @Output() declineRequest = new EventEmitter<AccessRequest>();
  @Output() settingsChanged = new EventEmitter<ProfessionalSettings>();
  @Output() logoutRequested = new EventEmitter<void>();

  selectedTab: string = 'dashboard';

  ngOnInit() {
    // Component initialization
  }

  selectTab(tab: string) {
    this.selectedTab = tab;
  }

  navigateToDoctorDashboard() {
    this.navigateToDashboard.emit();
  }

  acceptAccessRequest(request: AccessRequest) {
    this.acceptRequest.emit(request);
  }

  declineAccessRequest(request: AccessRequest) {
    this.declineRequest.emit(request);
  }

  saveProfessionalSettings() {
    this.settingsChanged.emit(this.professionalSettings);
  }

  logout() {
    this.logoutRequested.emit();
  }

  // Helper methods for template
  getRequestAge(requestDate: Date | string): string {
    const date = new Date(requestDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  }

  getExpiryDate(expiryDate: Date | string | undefined): string {
    if (!expiryDate) return 'N/A';
    const date = new Date(expiryDate);
    return date.toLocaleDateString();
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  }

  getActivityIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'access_request': 'mail-outline',
      'patient_update': 'person-outline',
      'consultation': 'medical-outline',
      'emergency': 'warning-outline',
      'default': 'information-circle-outline'
    };
    return icons[type] || icons['default'];
  }

  getActivityColor(type: string): string {
    const colors: { [key: string]: string } = {
      'access_request': 'warning',
      'patient_update': 'primary',
      'consultation': 'tertiary',
      'emergency': 'danger',
      'default': 'medium'
    };
    return colors[type] || colors['default'];
  }
}
