import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { DoctorPatient, AllergicReaction, TreatmentOutcome, DoctorVisit, MedicalHistory, EHRService } from '../../core/services/ehr.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-patient-analysis',
  templateUrl: './patient-analysis.modal.html',
  styleUrls: ['./patient-analysis.modal.scss'],
  standalone: false,
})
export class PatientAnalysisModal implements OnInit {

  @Input() patient!: DoctorPatient;
  @Input() patientId?: string;
  @Input() canConfirmVisits: boolean = false;
  @Input() analysis: {
    personalInfo: any;
    allergies: any[];
    visitHistory: DoctorVisit[];
    medicalHistory: MedicalHistory[];
  } = {
    personalInfo: {},
    allergies: [],
    visitHistory: [],
    medicalHistory: []
  };

  selectedTab: 'overview' | 'reactions' | 'treatments' | 'visits' | 'history' = 'overview';

  constructor(
    private modalController: ModalController,
    private toastr: ToastController,
    private ehrService: EHRService,
    private authService: AuthService
  ) { }

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
    return (this.analysis.allergies || []).length > 0;
  }

  canManageVisit(visit: DoctorVisit): boolean {
    if (!this.canConfirmVisits) {
      return false;
    }

    const currentDoctorEmail = this.authService.getCurrentUserEmail()?.trim().toLowerCase();
    const assignedDoctorEmail = visit.doctorEmail?.trim().toLowerCase();

    return !!currentDoctorEmail && !!assignedDoctorEmail && currentDoctorEmail === assignedDoctorEmail;
  }

  async confirmVisit(visit: DoctorVisit) {
    const patientId = this.patient?.patientId || this.patientId;
    if (!patientId || !visit?.id) return;

    if (!this.canManageVisit(visit)) {
      const toast = await this.toastr.create({
        message: 'Only the assigned doctor can confirm this visit.',
        duration: 2500,
        position: 'bottom',
        color: 'warning'
      });
      await toast.present();
      return;
    }

    try {
      await this.ehrService.confirmDoctorVisit(patientId, visit.id);
      const toast = await this.toastr.create({
        message: 'Visit confirmed successfully',
        duration: 2000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
      this.analysis = await this.ehrService.getPatientAnalysis(patientId);
    } catch (error) {
      console.error('Error confirming visit:', error);
      const toast = await this.toastr.create({
        message: 'Could not confirm visit. Please try again.',
        duration: 2500,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    }
  }

  async rejectVisit(visit: DoctorVisit) {
    const patientId = this.patient?.patientId || this.patientId;
    if (!patientId || !visit?.id) return;

    if (!this.canManageVisit(visit)) {
      const toast = await this.toastr.create({
        message: 'Only the assigned doctor can reject this visit.',
        duration: 2500,
        position: 'bottom',
        color: 'warning'
      });
      await toast.present();
      return;
    }

    try {
      await this.ehrService.rejectDoctorVisit(patientId, visit.id);
      const toast = await this.toastr.create({
        message: 'Visit rejected',
        duration: 2000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
      this.analysis = await this.ehrService.getPatientAnalysis(patientId);
    } catch (error) {
      console.error('Error rejecting visit:', error);
      const toast = await this.toastr.create({
        message: 'Could not reject visit. Please try again.',
        duration: 2500,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
    }
  }
}
