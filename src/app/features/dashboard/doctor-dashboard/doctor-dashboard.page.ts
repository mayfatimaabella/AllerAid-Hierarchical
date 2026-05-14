import { Component, OnInit, OnDestroy } from '@angular/core';
import { EHRService, DoctorPatient, AllergicReaction, TreatmentOutcome, AccessRequest } from '../../../core/services/ehr.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { ToastController, ModalController, MenuController, PopoverController, AlertController } from '@ionic/angular';
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

  doctorEmail: string = '';
  doctorName: string = '';
  userRole: string = '';
  isNurse: boolean = false;
  patients: DoctorPatient[] = [];
  filteredPatients: DoctorPatient[] = [];
  
  // Dashboard statistics
  stats = {
    totalPatients: 0,
    activeEmergencies: 0
  };

  // Filters and search
  searchTerm: string = '';
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
    private router: Router,
    private alertController: AlertController
  ) { }

  async ngOnInit() {
    // Disable the side menu for professional dashboard
    await this.menuController.enable(false, 'first');
    
    await this.loadDoctorInfo();
    await this.loadPatients();
  }

  async ngOnDestroy() {
    // Re-enable the side menu when leaving the page
    await this.menuController.enable(true, 'first');
  }

  async loadDoctorInfo() {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (currentUser) {
        const userProfile = await this.userService.getUserProfile(currentUser.uid);
        this.doctorEmail = currentUser.email || '';
        this.doctorName = userProfile?.fullName || 'Healthcare Provider';
        this.userRole = userProfile?.role || 'user';
        this.isNurse = this.userRole === 'nurse';
      }
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
      this.presentToast('Error loading patient data');
    } finally {
      this.loading = false;
    }
  }



  calculateStats() {
    this.stats.totalPatients = this.patients.length;
    this.stats.activeEmergencies = this.patients.filter(p => p.riskLevel === 'critical').length;
  }

  filterPatients() {
    let filtered = [...this.patients];

    // Apply search filter
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.patientName.toLowerCase().includes(term) ||
        p.patientEmail.toLowerCase().includes(term) ||
        p.primaryAllergies.some(a => a.toLowerCase().includes(term))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.patientName.localeCompare(b.patientName);
        case 'lastVisit':
          return new Date(b.lastVisit || 0).getTime() - new Date(a.lastVisit || 0).getTime();
        default:
          return 0;
      }
    });

    this.filteredPatients = filtered;
  }

  onSearchChange(event: any) {
    this.searchTerm = event.target.value;
    this.filterPatients();
  }



  onSortChange(event: any) {
    this.sortBy = event.target.value;
    this.filterPatients();
  }



  async viewPatientAnalysis(patient: DoctorPatient) {
    try {
      const analysis = await this.ehrService.getPatientAnalysis(patient.patientId);
      
      const modal = await this.modalController.create({
        component: PatientAnalysisModal,
        componentProps: {
          patient: patient,
          analysis: analysis
        }
      });

      await modal.present();
    } catch (error) {
      console.error('Error loading patient analysis:', error);
      this.presentToast('Error loading patient analysis');
    }
  }

  async addTreatmentOutcome(patient: DoctorPatient) {
    if (this.isNurse) {
      this.presentToast('Treatment outcome modification requires doctor privileges');
      return;
    }
    // This would open a modal for adding treatment outcomes
    this.presentToast('Treatment outcome feature - to be implemented');
  }

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

  getNextAppointmentStatus(nextAppointment?: string): string {
    if (!nextAppointment) return '';
    
    const appointmentDate = new Date(nextAppointment);
    const now = new Date();
    const diffTime = appointmentDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return `In ${Math.floor(diffDays / 7)} week(s)`;
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



  /**
   * Open professional user menu popover
   */
  async openUserMenu(event: any) {
    const popover = await this.popoverController.create({
      component: UserMenuPopover,
      event: event,
      translucent: true,
      showBackdrop: true,
      componentProps: {
        doctorName: this.doctorName,
        doctorEmail: this.doctorEmail,
        userRole: this.userRole
      }
    });

    await popover.present();

    const { data } = await popover.onDidDismiss();
    if (data?.action === 'logout') {
      await this.logout();
    }
  }

  /**
   * Professional logout functionality
   */
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







