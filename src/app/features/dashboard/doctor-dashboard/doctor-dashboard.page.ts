import { Component, OnInit, OnDestroy } from '@angular/core';
import { EHRService, DoctorPatient } from '../../../core/services/ehr.service';
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

@Component({
  selector: 'app-doctor-dashboard',
  templateUrl: './doctor-dashboard.page.html',
  styleUrls: ['./doctor-dashboard.page.scss'],
  standalone: false,
})
export class DoctorDashboardPage implements OnInit, OnDestroy {
  doctorEmail = '';
  doctorName = '';

  patients: DoctorPatient[] = [];
  filteredPatients: DoctorPatient[] = [];

  stats = {
    totalPatients: 0,
    grantedEhrAccess: 0
  };

  searchTerm = '';
  sortBy: 'name' | 'lastVisit' = 'name';

  loading = true;

  constructor(
    private ehrService: EHRService,
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
    await this.loadPatients();
  }

  async ngOnDestroy() {
    await this.menuController.enable(true, 'first');
  }

  async loadDoctorInfo() {
    try {
      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        return;
      }

      const userProfile = await this.userService.getUserProfile(currentUser.uid);

      this.doctorEmail = currentUser.email || '';
      this.doctorName = userProfile?.fullName || 'Healthcare Provider';
    } catch (error) {
      console.error('Error loading doctor info:', error);
    }
  }

  async loadPatients() {
    try {
      this.loading = true;

      this.patients = await this.ehrService.getDoctorPatients(this.doctorEmail);

      this.calculateStats();
      this.filterPatients();
    } catch (error) {
      console.error('Error loading patients:', error);
      await this.presentToast('Error loading patient records');
    } finally {
      this.loading = false;
    }
  }

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
        patient.primaryAllergies?.some(allergy =>
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

  async viewPatientEhr(patient: DoctorPatient) {
    try {
      const analysis = await this.ehrService.getPatientAnalysis(patient.patientId);

      const modal = await this.modalController.create({
        component: PatientAnalysisModal,
        componentProps: {
          patient,
          analysis
        }
      });

      await modal.present();
    } catch (error) {
      console.error('Error loading patient EHR:', error);
      await this.presentToast('Error loading patient EHR');
    }
  }

  async viewVisitLogs(patient: DoctorPatient) {
    try {
      const analysis = await this.ehrService.getPatientAnalysis(patient.patientId);

      const modal = await this.modalController.create({
        component: PatientAnalysisModal,
        componentProps: {
          patient,
          analysis,
          selectedSection: 'visits'
        }
      });

      await modal.present();
    } catch (error) {
      console.error('Error loading visit logs:', error);
      await this.presentToast('Error loading visit logs');
    }
  }

  async viewMedications(patient: DoctorPatient) {
    try {
      const analysis = await this.ehrService.getPatientAnalysis(patient.patientId);

      const modal = await this.modalController.create({
        component: PatientAnalysisModal,
        componentProps: {
          patient,
          analysis,
          selectedSection: 'medications'
        }
      });

      await modal.present();
    } catch (error) {
      console.error('Error loading medications:', error);
      await this.presentToast('Error loading medications');
    }
  }

  getTimeSinceLastVisit(lastVisit?: string): string {
    if (!lastVisit) {
      return 'No visits';
    }

    const visitDate = new Date(lastVisit);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - visitDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return '1 day ago';
    }

    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }

    if (diffDays < 30) {
      return `${Math.floor(diffDays / 7)} week(s) ago`;
    }

    return `${Math.floor(diffDays / 30)} month(s) ago`;
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom'
    });

    await toast.present();
  }

  async refreshData() {
    await this.loadPatients();
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

  async logout() {
    try {
      await this.authService.signOut();
      await this.presentToast('Logged out successfully');
      await this.router.navigate(['/login'], { replaceUrl: true });
    } catch (error) {
      console.error('Logout error:', error);
      await this.presentToast('Error logging out. Please try again.');
    }
  }
}