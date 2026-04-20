import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { DoctorPatient, AllergicReaction, TreatmentOutcome, DoctorVisit, MedicalHistory } from '../../core/services/ehr.service';

@Component({
  selector: 'app-patient-analysis',
  templateUrl: './patient-analysis.modal.html',
  styleUrls: ['./patient-analysis.modal.scss'],
  standalone: false,
})
export class PatientAnalysisModal implements OnInit {

  @Input() patient!: DoctorPatient;
  @Input() analysis: {
    personalInfo: any;
    allergies: any[];
    recentReactions: AllergicReaction[];
    treatmentHistory: TreatmentOutcome[];
    visitHistory: DoctorVisit[];
    medicalHistory: MedicalHistory[];
    riskFactors: string[];
    recommendations: string[];
  } = {
    personalInfo: {},
    allergies: [],
    recentReactions: [],
    treatmentHistory: [],
    visitHistory: [],
    medicalHistory: [],
    riskFactors: [],
    recommendations: []
  };

  selectedTab: 'overview' | 'reactions' | 'treatments' | 'visits' | 'history' = 'overview';

  constructor(private modalController: ModalController) { }

  ngOnInit() {
    console.log('Patient Analysis:', this.analysis);
  }

  dismiss() {
    this.modalController.dismiss();
  }

  selectTab(tab: string | number | undefined) {
    const validTabs = ['overview', 'reactions', 'treatments', 'visits', 'history'];
    const tabString = tab?.toString();
    if (tabString && validTabs.includes(tabString)) {
      this.selectedTab = tabString as 'overview' | 'reactions' | 'treatments' | 'visits' | 'history';
    }
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'life-threatening': return 'danger';
      case 'severe': return 'warning';
      case 'moderate': return 'primary';
      case 'mild': return 'success';
      default: return 'medium';
    }
  }

  getOutcomeColor(response: string): string {
    switch (response) {
      case 'excellent': return 'success';
      case 'good': return 'primary';
      case 'fair': return 'warning';
      case 'poor': return 'danger';
      default: return 'medium';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'danger';
      case 'chronic': return 'warning';
      case 'resolved': return 'success';
      case 'not-cured': return 'danger';
      default: return 'medium';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  getTimeSince(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week(s) ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} month(s) ago`;
    return `${Math.floor(diffDays / 365)} year(s) ago`;
  }

  hasCheckedAllergies(): boolean {
    return (this.analysis.allergies || []).some(a => a.checked);
  }
}
