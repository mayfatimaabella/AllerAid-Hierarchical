import { Component, OnInit } from '@angular/core';
import { ToastController, ModalController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { DoctorService } from '../../../core/services/doctor.service';
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

  // Loading guards to prevent duplicate calls
  private isLoadingDoctors = false;
  private isLoadingInvitations = false;

  // FIX: currentUserId stored at init so deleteDoctor can pass it explicitly
  // instead of relying on the removed localStorage fallback.
  private currentUserId: string = '';

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
    private doctorService: DoctorService,
    private toastController: ToastController,
    private modalController: ModalController
  ) {}

  async ngOnInit() {
    // Resolve and cache the current user id once so all actions use the same value.
    const currentUser = await this.authService.waitForAuthInit();
    if (currentUser) {
      this.currentUserId = currentUser.uid;
    }

    await this.loadInvitationCount();
    await this.loadDoctors();
  }

  // ─── Details modal ────────────────────────────────────────────────────────────

  showDoctorDetails(doctor: any) {
    this.doctorToShowDetails = doctor;
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.doctorToShowDetails = null;
  }

  // ─── Data loading ─────────────────────────────────────────────────────────────

  async loadInvitationCount() {
    if (this.isLoadingInvitations) return;
    this.isLoadingInvitations = true;
    try {
      if (this.currentUserId) {
        const received = await this.doctorService.getReceivedInvitations(this.currentUserId);
        this.invitationCount = received.length;
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
      if (this.currentUserId) {
        this.doctors = await this.doctorService.getUserDoctors(this.currentUserId);
        this.filteredDoctors = [...this.doctors];
      } else {
        this.doctors = [];
        this.filteredDoctors = [];
      }
    } catch (error) {
      console.error('Error loading doctors:', error);
      await this.showToast('Error loading doctors', 'danger');
    } finally {
      this.isLoadingDoctors = false;
    }
  }

  // ─── Search ───────────────────────────────────────────────────────────────────

  searchDoctor() {
    if (!this.searchTerm) {
      this.filteredDoctors = this.doctors;
      return;
    }
    const term = this.searchTerm.toLowerCase();
    this.filteredDoctors = this.doctors.filter(doctor =>
      (doctor.firstName  && doctor.firstName.toLowerCase().includes(term))  ||
      (doctor.lastName   && doctor.lastName.toLowerCase().includes(term))   ||
      (doctor.email      && doctor.email.toLowerCase().includes(term))      ||
      (doctor.specialty  && doctor.specialty.toLowerCase().includes(term))
    );
  }

  // ─── Actions modal ────────────────────────────────────────────────────────────

  openDoctorActions(doctor: any) {
    this.selectedDoctor = doctor;
    this.showActionsModal = true;
  }

  closeDoctorActions() {
    this.showActionsModal = false;
    this.selectedDoctor = null;
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────────

  onEditDoctor(doctor: any) {
    this.doctorToEdit = doctor;
    this.showEditModal = true;
    this.closeDoctorActions();
  }

  closeEditModal() {
    this.showEditModal = false;
    this.doctorToEdit = null;
  }

  async onSaveEditDoctor(updatedDoctor: any) {
    try {
      await this.showToast('Doctor information saved', 'success');
      this.closeEditModal();
      await this.loadDoctors();
    } catch (error) {
      console.error('Error updating doctor:', error);
      await this.showToast('Error updating doctor', 'danger');
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  onDeleteDoctor(doctor: any) {
    this.doctorToEdit = doctor;
    this.showDeleteModal = true;
    this.closeDoctorActions();
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.doctorToEdit = null;
  }

  async onConfirmDeleteDoctor(doctor: any) {
    try {
      // FIX: was calling deleteDoctor(doctor) with 1 arg — the method now requires
      // currentUserId explicitly so it no longer falls back to localStorage.
      await this.doctorService.deleteDoctor(doctor, this.currentUserId);
      await this.showToast('Doctor removed successfully', 'success');
      this.closeDeleteModal();
      await this.loadDoctors();
    } catch (error) {
      console.error('Error deleting doctor:', error);
      await this.showToast('Error removing doctor', 'danger');
    }
  }

  // ─── Invitations modal ────────────────────────────────────────────────────────

  async openInvitationsModal() {
    const modal = await this.modalController.create({
      component: DoctorInviteModalComponent,
      cssClass: 'doctor-invite-modal',
      backdropDismiss: true
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data) {
      await this.loadDoctors();
      await this.loadInvitationCount();
    }
  }

  // ─── Pull-to-refresh ──────────────────────────────────────────────────────────

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

  // ─── Toast ────────────────────────────────────────────────────────────────────

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