import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, DatePipe, SlicePipe } from '@angular/common';
import { DoctorVisit, MedicalHistory, HealthcareProvider } from '../../../core/services/ehr.service';
import { EhrAccessManagementCardComponent } from './access-management/ehr-access-management-card.component';

@Component({
  selector: 'app-ehr-section-cards',
  templateUrl: './ehr-section-cards.html',
  styleUrls: ['./ehr-section-cards.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    NgIf,
    NgFor,
    DatePipe,
    SlicePipe,
    EhrAccessManagementCardComponent
  ]
})
export class EHRSectionCardsComponent {
  visitActionsEvent: any = null;
  @Output() deleteDoctorVisit = new EventEmitter<DoctorVisit>();
  @Output() editDoctorVisit = new EventEmitter<DoctorVisit>();


  visitActionsPopover: DoctorVisit | null = null;
  historyActionsEvent: any = null;
  historyActionsPopover: MedicalHistory | null = null;
  selectedTab: string = 'ehr';

  deleteDoctorVisitHandler(visit: DoctorVisit) {
    this.deleteDoctorVisit.emit(visit);
  }

  editDoctorVisitHandler(visit: DoctorVisit) {
    this.editDoctorVisit.emit(visit);
  }

  newProviderSpecialty: string = '';
  newProviderHospital: string = '';
  @Input() newProviderEmail: string = '';
  @Input() newProviderName: string = '';
  @Input() newProviderRole: 'doctor' | 'nurse' = 'doctor';
  @Input() newProviderLicense: string = '';
  getVisitTypeColor(type: string): string {
    switch (type) {
      case 'routine': return 'primary';
      case 'urgent': return 'warning';
      case 'emergency': return 'danger';
      case 'follow-up': return 'secondary';
      case 'specialist': return 'tertiary';
      default: return 'medium';
    }
  }

  getVisitTypeLabel(type: string): string {
    switch (type) {
      case 'routine': return 'Routine';
      case 'urgent': return 'Urgent';
      case 'emergency': return 'Emergency';
      case 'follow-up': return 'Follow-up';
      case 'specialist': return 'Specialist';
      default: return 'Other';
    }
  }

  getVisitTypeClass(type: string): string {
    switch (type) {
      case 'routine': return 'visit-status-routine';
      case 'urgent': return 'visit-status-urgent';
      case 'emergency': return 'visit-status-emergency';
      case 'follow-up': return 'visit-status-followup';
      case 'specialist': return 'visit-status-specialist';
      default: return 'visit-status-other';
    }
  }

  getHistoryStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'danger';
      case 'resolved': return 'success';
      case 'chronic': return 'warning';
      case 'not-cured': return 'danger';
      default: return 'medium';
    }
  }
  getHistoryStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'history-status-active';
      case 'resolved': return 'history-status-resolved';
      case 'not-cured': return 'history-status-not-cured';
      case 'chronic': return 'history-status-chronic';
      default: return 'history-status-other';
    }
  }
  @Input() doctorVisits: DoctorVisit[] = [];
  @Input() medicalHistory: MedicalHistory[] = [];
  @Input() ehrAccessList: string[] = [];
  @Input() isLoadingDoctorVisits: boolean = false;
  @Input() isLoadingMedicalHistory: boolean = false;
  @Input() isDoctorVisitsExpanded: boolean = false;
  @Input() isMedicalHistoryExpanded: boolean = false;

  @Output() addDoctorVisit = new EventEmitter<void>();
  @Output() addMedicalHistory = new EventEmitter<void>();
  @Output() sendAccessRequest = new EventEmitter<void>();
  @Output() revokeEHRAccess = new EventEmitter<{ provider: string }>();
  @Output() expandMedicalHistory = new EventEmitter<void>();
  @Output() openVisitDetails = new EventEmitter<{ doctorVisit: DoctorVisit }>();
  @Output() openMedicalHistoryDetails = new EventEmitter<{ medicalHistory: MedicalHistory }>();
  @Output() presentVisitActionsPopover = new EventEmitter<{ event: any, visit: DoctorVisit }>();
  @Output() presentHistoryActionsPopover = new EventEmitter<{ event: any, history: MedicalHistory }>();

  // Modal and CRUD handlers
  openAddDoctorVisitModal() {
    this.addDoctorVisit.emit();
  }

  openAddMedicalHistoryModal() {
    this.addMedicalHistory.emit();
  }

  sendAccessRequestHandler() {
    this.sendAccessRequest.emit();
  }

  revokeEHRAccessHandler(provider: string) {
    this.revokeEHRAccess.emit({ provider });
  }

  expandMedicalHistoryHandler() {
    this.expandMedicalHistory.emit();
  }

  openVisitDetailsHandler(doctorVisit: DoctorVisit) {
    this.openVisitDetails.emit({ doctorVisit });
  }

  constructor(private navCtrl: NavController) {}

  openMedicalHistoryDetailsHandler(medicalHistory: MedicalHistory) {
    if (medicalHistory?.id) {
      // Use Ionic navigation for smooth animated transition instead of full page reload
      this.navCtrl.navigateForward(`/medical-history-details/${medicalHistory.id}`);
    } else {
      this.openMedicalHistoryDetails.emit({ medicalHistory });
    }
  }

  presentVisitActionsPopoverHandler(event: any, visit: DoctorVisit) {
  this.visitActionsEvent = event;
  this.visitActionsPopover = visit;
  this.presentVisitActionsPopover.emit({ event, visit });
  }

  presentHistoryActionsPopoverHandler(event: any, history: MedicalHistory) {
    this.historyActionsEvent = event;
    this.historyActionsPopover = history;
    this.presentHistoryActionsPopover.emit({ event, history });
  }
}
