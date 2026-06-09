import { Component, OnInit, OnDestroy } from '@angular/core';
import { EHRService } from '../../../core/services/ehr.service';
import { DoctorService, DoctorInvitation } from '../../../core/services/doctor.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import {
  ToastController,
  ModalController,
  MenuController,
  PopoverController
} from '@ionic/angular';
import { PatientAnalysisModal } from '../../../shared/modals/patient-analysis.modal';
import { Router } from '@angular/router';
import { UserMenuPopover } from './user-menu-popover.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-doctor-dashboard',
  templateUrl: './doctor-dashboard.page.html',
  styleUrls: ['./doctor-dashboard.page.scss'],
  standalone: false,
})
export class DoctorDashboardPage implements OnInit, OnDestroy {
  doctorEmail = '';
  doctorName = '';
  doctorUid = '';

  patients: any[] = [];
  filteredPatients: any[] = [];

  pendingInvitations: DoctorInvitation[] = [];

  stats = {
    totalPatients: 0,
    grantedEhrAccess: 0
  };

  searchTerm = '';
  sortBy: 'name' | 'lastVisit' = 'name';
  loading = true;

  private invitationListener: (() => void) | null = null;
  private invitationsSubscription: Subscription | null = null;
  private patientsListener: (() => void) | null = null;
  private patientsSubscription: Subscription | null = null;

  constructor(
    private ehrService: EHRService,
    private doctorService: DoctorService,
    private authService: AuthService,
    private userService: UserService,
    private toastController: ToastController,
    private modalController: ModalController,
    private menuController: MenuController,
    private popoverController: PopoverController,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.menuController.enable(false, 'first');
    await this.loadDoctorInfo();
    this.startPatientsListener();
    this.startInvitationListener();
  }

  ngOnDestroy() {
    this.menuController.enable(true, 'first');
    if (this.invitationListener) {
      this.invitationListener();
      this.invitationListener = null;
    }
    if (this.invitationsSubscription) {
      this.invitationsSubscription.unsubscribe();
    }
    if (this.patientsSubscription) {
      this.patientsSubscription.unsubscribe();
    }
    if (this.patientsListener) {
      this.patientsListener();
      this.patientsListener = null;
    }
  }

  async loadDoctorInfo() {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      this.doctorUid = currentUser.uid;
      const userProfile = await this.userService.getUserProfile(currentUser.uid);
      this.doctorEmail = currentUser.email || '';
      this.doctorName = userProfile?.fullName || 'Healthcare Provider';
    } catch (error) {
      console.error('Error loading doctor info:', error);
    }
  }

  // ─── Real-time patients listener ─────────────────────────────────────────────

startPatientsListener() {
  if (!this.doctorUid) return;

  this.loading = true;

  this.patientsListener = this.doctorService.listenForDoctorRelations(this.doctorUid);

  this.patientsSubscription = this.doctorService.doctorRelations$.subscribe(
    async (relations: any[]) => {
      const patientRelations = relations.filter(r => r.relationship === 'Patient');

      console.log(
        'doctorRelations$ fired — total relations:',
        relations.length,
        '| patient relations:',
        patientRelations.length
      );

      try {
        this.patients = await Promise.all(
          patientRelations.map(async (relation: any) => {
            console.log('FULL RELATION:', relation);

            const patientId =
              relation.patientUid ||
              relation.userUid ||
              relation.patientId ||
              relation.fromUserId ||
              relation.doctorUid;

            const patientName =
              relation.patientName ||
              relation.userName ||
              relation.fromUserName ||
              relation.doctorName ||
              'Unknown Patient';

            const patientEmail =
              relation.patientEmail ||
              relation.userEmail ||
              relation.fromUserEmail ||
              relation.doctorEmail ||
              '';

            console.log(
              'Processing patient relation — patientId:',
              patientId,
              'name:',
              patientName
            );

            try {
              const analysis = await this.ehrService.getPatientAnalysis(patientId);

              return {
                patientId,
                patientName,
                patientEmail,
                dateOfBirth: analysis?.personalInfo?.dateOfBirth || '',
                primaryAllergies:this.extractAllergies(analysis),

                lastVisit: analysis?.visitHistory?.[0]?.visitDate || undefined,
                riskLevel: 'low',
                totalVisits: analysis?.visitHistory?.length || 0,
                accessGrantedDate: relation.acceptedAt,
              };
            } catch (error) {
              console.error(
                'Failed to load patient analysis for:',
                patientId,
                error
              );

              return {
                patientId,
                patientName,
                patientEmail,
                dateOfBirth: '',
                primaryAllergies: [],
                lastVisit: undefined,
                riskLevel: 'low',
                totalVisits: 0,
                accessGrantedDate: relation.acceptedAt,
              };
            }
          })
        );

        this.calculateStats();
        this.filterPatients();
      } catch (error) {
        console.error('Error processing patient records:', error);
        await this.presentToast('Error loading patient records', 'danger');
      } finally {
        this.loading = false;
      }
    }
  );
}

  // ─── Real-time invitation listener ───────────────────────────────────────────

  startInvitationListener() {
    if (!this.doctorUid) return;

    this.invitationListener = this.doctorService.listenForDoctorInvitations(this.doctorUid);

    this.invitationsSubscription = this.doctorService.pendingInvitations$.subscribe(
      invitations => {
        console.log('pendingInvitations$ fired — count:', invitations.length);
        this.pendingInvitations = invitations;
      }
    );
  }

  // ─── Accept / Decline ────────────────────────────────────────────────────────

  async acceptInvitation(invite: DoctorInvitation) {
    try {
      console.log('Accepting invitation:', invite.id, '| from:', invite.fromUserName,
                  '| fromUserId:', invite.fromUserId);
      await this.doctorService.acceptDoctorInvitationWithUser(
        invite.id!,
        this.doctorUid
      );
      await this.presentToast(`Accepted invitation from ${invite.fromUserName}`, 'success');
      
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      await this.presentToast(error.message || 'Error accepting invitation', 'danger');
    }
  }

  async declineInvitation(invite: DoctorInvitation) {
    try {
      await this.doctorService.declineDoctorInvitationWithUser(
        invite.id!,
        this.doctorUid
      );
      await this.presentToast(`Declined invitation from ${invite.fromUserName}`, 'medium');
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      await this.presentToast(error.message || 'Error declining invitation', 'danger');
    }
  }

  // ─── Stats & filter ───────────────────────────────────────────────────────────

  calculateStats() {
    this.stats.totalPatients = this.patients.length;
    this.stats.grantedEhrAccess = this.patients.length;
  }

  filterPatients() {
    let filtered = [...this.patients];

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(patient =>
        patient.patientName?.toLowerCase().includes(term) ||
        patient.patientEmail?.toLowerCase().includes(term) ||
        patient.primaryAllergies?.some((allergy: string) =>
          allergy.toLowerCase().includes(term)
        )
      );
    }

    filtered.sort((a, b) => {
      if (this.sortBy === 'lastVisit') {
        return (
          new Date(b.lastVisit || 0).getTime() -
          new Date(a.lastVisit || 0).getTime()
        );
      }
      return a.patientName.localeCompare(b.patientName);
    });

    this.filteredPatients = filtered;
  }

  onSearchChange(event: any) {
    this.searchTerm = event.detail.value || '';
    this.filterPatients();
  }

  onSortChange(event: any) {
    this.sortBy = event.detail.value;
    this.filterPatients();
  }

  // ─── View modals ──────────────────────────────────────────────────────────────

  async viewPatientEhr(patient: any) {
    try {
      const analysis = await this.ehrService.getPatientAnalysis(patient.patientId);
      const modal = await this.modalController.create({
        component: PatientAnalysisModal,
        componentProps: { patient, analysis }
      });
      await modal.present();
    } catch (error) {
      console.error('Error loading patient EHR:', error);
      await this.presentToast('Error loading patient EHR', 'danger');
    }
  }

  async viewVisitLogs(patient: any) {
    try {
      const analysis = await this.ehrService.getPatientAnalysis(patient.patientId);
      const modal = await this.modalController.create({
        component: PatientAnalysisModal,
        componentProps: { patient, analysis, selectedSection: 'visits' }
      });
      await modal.present();
    } catch (error) {
      console.error('Error loading visit logs:', error);
      await this.presentToast('Error loading visit logs', 'danger');
    }
  }

  async viewMedications(patient: any) {
    try {
      const analysis = await this.ehrService.getPatientAnalysis(patient.patientId);
      const modal = await this.modalController.create({
        component: PatientAnalysisModal,
        componentProps: { patient, analysis, selectedSection: 'medications' }
      });
      await modal.present();
    } catch (error) {
      console.error('Error loading medications:', error);
      await this.presentToast('Error loading medications', 'danger');
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  getTimeSinceLastVisit(lastVisit?: string): string {
    if (!lastVisit) return 'No visits';
    const visitDate = new Date(lastVisit);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - visitDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week(s) ago`;
    return `${Math.floor(diffDays / 30)} month(s) ago`;
  }

  async presentToast(message: string, color: string = 'dark') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  async refreshData() {
    this.filterPatients();
  }

  async openUserMenu(event: any) {
    const popover = await this.popoverController.create({
      component: UserMenuPopover,
      event,
      translucent: true,
      showBackdrop: true,
      componentProps: {
        doctorName: this.doctorName,
        doctorEmail: this.doctorEmail
      }
    });
    await popover.present();
    const { data } = await popover.onDidDismiss();
    if (data?.action === 'logout') {
      await this.logout();
    }
  }
  extractAllergies(analysis: any): string[] {
  const allergies =
    analysis?.allergies ||
    analysis?.medicalInfo?.allergies ||
    analysis?.medical?.allergies ||
    analysis?.personalInfo?.allergies ||
    [];

  return allergies
    .map((allergy: any) => {
      if (typeof allergy === 'string') return allergy;
      return allergy.label || allergy.name || allergy.value || '';
    })
    .filter((allergy: string) => allergy.trim())
    .slice(0, 3);
}

  async logout() {
    try {
      await this.authService.signOut();
      await this.presentToast('Logged out successfully');
      await this.router.navigate(['/login'], { replaceUrl: true });
    } catch (error) {
      console.error('Logout error:', error);
      await this.presentToast('Error logging out. Please try again.', 'danger');
    }
  }
}