import { Component, OnInit } from '@angular/core';
import { ToastController, ModalController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { DoctorInviteModalComponent } from '../components/doctor-invite-modal.component';

@Component({
  selector: 'app-patients-doctor',
  templateUrl: './patients-doctor.page.html',
  styleUrls: ['./patients-doctor.page.scss'],
  standalone: false,
})
export class PatientsDoctorPage implements OnInit {
  showDetailsModal = false;
  doctorToShowDetails: any = null;
  
  // Loading states to prevent multiple calls
  private isLoadingDoctors = false;
  private isLoadingInvitations = false;

  showDoctorDetails(doctor: any) {
    this.doctorToShowDetails = doctor;
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.doctorToShowDetails = null;
  }
  
  doctors: any[] = [];
  filteredDoctors: any[] = [];
  searchTerm: string = '';
  showEditModal = false;
  showActionsModal = false;
  showDeleteModal = false;
  doctorToEdit: any = null;
  selectedDoctor: any = null;
  invitationCount: number = 0;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private toastController: ToastController,
    private modalController: ModalController,
  ) {}

  async ngOnInit() {
    await this.loadInvitationCount();
    this.loadDoctors();
  }

  async loadInvitationCount() {
    if (this.isLoadingInvitations) return;
    this.isLoadingInvitations = true;
    
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (currentUser) {
        // TODO: Implement get received doctor invitations
        this.invitationCount = 0;
      }
    } catch (error) {
      console.error('Error loading invitation count:', error);
      this.invitationCount = 0;
    } finally {
      this.isLoadingInvitations = false;
    }
  }

  async loadDoctors() {
    if (this.isLoadingDoctors) return;
    this.isLoadingDoctors = true;
    
    try {
      const currentUser = await this.authService.waitForAuthInit();
      
      if (currentUser) {
        // TODO: Implement get user doctors from service
        console.log('Loading doctors for current user:', currentUser.uid);
        this.doctors = [];
        this.filteredDoctors = [];
      } else {
        console.log('No current user found - redirecting to login');
        this.doctors = [];
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
      await this.showToast('Error loading doctors', 'danger');
    } finally {
      this.isLoadingDoctors = false;
    }
  }

  searchDoctor() {
    if (!this.searchTerm) {
      this.filteredDoctors = this.doctors;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredDoctors = this.doctors.filter(doctor =>
      (doctor.firstName && doctor.firstName.toLowerCase().includes(term)) ||
      (doctor.lastName && doctor.lastName.toLowerCase().includes(term)) ||
      (doctor.email && doctor.email.toLowerCase().includes(term)) ||
      (doctor.specialty && doctor.specialty.toLowerCase().includes(term))
    );
  }

  openDoctorActions(doctor: any) {
    this.selectedDoctor = doctor;
    this.showActionsModal = true;
  }

  closeDoctorActions() {
    this.showActionsModal = false;
    this.selectedDoctor = null;
  }

  onEditDoctor(doctor: any) {
    this.doctorToEdit = doctor;
    this.showEditModal = true;
    this.closeDoctorActions();
  }

  onDeleteDoctor(doctor: any) {
    this.doctorToEdit = doctor;
    this.showDeleteModal = true;
    this.closeDoctorActions();
  }

  closeEditModal() {
    this.showEditModal = false;
    this.doctorToEdit = null;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.doctorToEdit = null;
  }

  async onSaveEditDoctor(updatedDoctor: any) {
    try {
      // TODO: Implement save doctor changes logic
      await this.showToast('Doctor updated successfully', 'success');
      this.closeEditModal();
      this.loadDoctors();
    } catch (error) {
      console.error('Error updating doctor:', error);
      await this.showToast('Error updating doctor', 'danger');
    }
  }

  async onConfirmDeleteDoctor(doctor: any) {
    try {
      // TODO: Implement delete doctor logic
      await this.showToast('Doctor removed successfully', 'success');
      this.closeDeleteModal();
      this.loadDoctors();
    } catch (error) {
      console.error('Error deleting doctor:', error);
      await this.showToast('Error removing doctor', 'danger');
    }
  }

  async openInvitationsModal() {
    const modal = await this.modalController.create({
      component: DoctorInviteModalComponent,
      cssClass: 'doctor-invite-modal',
      backdropDismiss: true
    });
    await modal.present();
    
    const { data } = await modal.onDidDismiss();
    if (data) {
      this.loadDoctors();
      await this.loadInvitationCount();
    }
  }

  async handleRefresh(event: any) {
    try {
      await this.loadInvitationCount();
      await this.loadDoctors();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.detail.complete();
    }
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
