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
  pendingRequests: AccessRequest[] = [];
  
  // Dashboard statistics
  stats = {
    totalPatients: 0,
    criticalPatients: 0,
    highRiskPatients: 0,
    recentReactions: 0
  };

  // Filters and search
  searchTerm: string = '';
  riskFilter: 'all' | 'critical' | 'high' | 'medium' | 'low' = 'all';
  sortBy: 'name' | 'risk' | 'lastVisit' = 'risk';

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
    await this.loadAccessRequests();
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

  async loadAccessRequests() {
    try {
      this.pendingRequests = await this.ehrService.getPendingAccessRequests();
    } catch (error) {
      console.error('Error loading access requests:', error);
      this.presentToast('Error loading access requests');
    }
  }

  calculateStats() {
    this.stats.totalPatients = this.patients.length;
    this.stats.criticalPatients = this.patients.filter(p => p.riskLevel === 'critical').length;
    this.stats.highRiskPatients = this.patients.filter(p => p.riskLevel === 'high').length;
    
    // Follow-up appointments removed from simplified model
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

    // Apply risk filter
    if (this.riskFilter !== 'all') {
      filtered = filtered.filter(p => p.riskLevel === this.riskFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.patientName.localeCompare(b.patientName);
        case 'risk':
          const riskOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
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

  onRiskFilterChange(event: any) {
    this.riskFilter = event.target.value;
    this.filterPatients();
  }

  onSortChange(event: any) {
    this.sortBy = event.target.value;
    this.filterPatients();
  }

  getRiskColor(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'success';
      default: return 'medium';
    }
  }

  getRiskIcon(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return 'warning';
      case 'high': return 'alert-circle';
      case 'medium': return 'information-circle';
      case 'low': return 'checkmark-circle';
      default: return 'help-circle';
    }
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
    await this.loadAccessRequests();
  }

  /**
   * Accept an access request from a patient
   */
  async acceptAccessRequest(request: AccessRequest) {
    const alert = await this.alertController.create({
      header: 'Accept Access Request',
      message: `Accept access to ${request.patientName}'s medical records? You will be able to view their complete EHR including allergies, medications, and visit history.`,
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Optional notes about accepting this patient...'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Accept Patient',
          handler: async (data) => {
            try {
              await this.ehrService.respondToAccessRequest(request.id!, 'accepted', data.notes);
              await this.presentToast(`Access granted to ${request.patientName}`);
              await this.refreshData(); // Refresh both patients and requests
            } catch (error) {
              console.error('Error accepting request:', error);
              await this.presentToast('Error accepting request. Please try again.');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Decline an access request from a patient
   */
  async declineAccessRequest(request: AccessRequest) {
    const alert = await this.alertController.create({
      header: 'Decline Access Request',
      message: `Decline access request from ${request.patientName}? They will be notified that you declined to access their medical records.`,
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Optional reason for declining (patient will not see this)...'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Decline Request',
          handler: async (data) => {
            try {
              await this.ehrService.respondToAccessRequest(request.id!, 'declined', data.notes);
              await this.presentToast(`Request from ${request.patientName} declined`);
              await this.loadAccessRequests(); // Refresh requests list
            } catch (error) {
              console.error('Error declining request:', error);
              await this.presentToast('Error declining request. Please try again.');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Get human-readable age of the request
   */
  getRequestAge(requestDate: Date | any): string {
    const now = new Date();
    const reqDate = new Date(requestDate);
    const diffTime = Math.abs(now.getTime() - reqDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week(s) ago`;
    return `${Math.floor(diffDays / 30)} month(s) ago`;
  }

  /**
   * Get human-readable expiry date
   */
  getExpiryDate(expiryDate: Date | any): string {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    if (diffDays < 30) return `In ${Math.floor(diffDays / 7)} week(s)`;
    return `In ${Math.floor(diffDays / 30)} month(s)`;
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

  /**
   * Show access requests section or notification
   */
  async showAccessRequests() {
    if (this.pendingRequests.length === 0) {
      await this.presentToast('No pending access requests');
      return;
    }

    // Scroll to access requests section if it exists
    const accessRequestsSection = document.querySelector('.access-requests-section');
    if (accessRequestsSection) {
      accessRequestsSection.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    } else {
      // If section doesn't exist (no requests), show notification
      const alert = await this.alertController.create({
        header: `${this.pendingRequests.length} Access Request${this.pendingRequests.length > 1 ? 's' : ''}`,
        message: `You have ${this.pendingRequests.length} patient${this.pendingRequests.length > 1 ? 's' : ''} requesting access to their medical records.`,
        buttons: [
          {
            text: 'Review Later',
            role: 'cancel'
          },
          {
            text: 'Refresh',
            handler: () => {
              this.refreshData();
            }
          }
        ]
      });

      await alert.present();
    }
  }
}







