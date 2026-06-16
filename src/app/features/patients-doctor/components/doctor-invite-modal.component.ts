import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController, AlertController } from '@ionic/angular';
import { UserService } from '../../../core/services/user.service';
import { DoctorService } from '../../../core/services/doctor.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-doctor-invite-modal',
  templateUrl: './doctor-invite-modal.component.html',
  styleUrls: ['./doctor-invite-modal.component.scss'],
  standalone: false,
})
export class DoctorInviteModalComponent implements OnInit {

  selectedSegment: 'invite' | 'received' | 'sent' = 'invite';

  // Send invitation form
  inviteEmail: string = '';
  inviteMessage: string =
    'Hi! I would like you to be my healthcare provider on AllerAid. ' +
    'Please accept this invitation to manage my allergy information and emergency care.';

  // Search functionality
  searchResults: any[] = [];
  selectedUser: any = null;
  isSearching: boolean = false;
  showSearchDropdown: boolean = false;

  // Invitation lists
  receivedInvitations: any[] = [];
  sentInvitations: any[] = [];

  isLoading: boolean = false;
  currentUserId: string = '';

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private alertController: AlertController,
    private userService: UserService,
    private doctorService: DoctorService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    try {
      const currentUser = await this.userService.getCurrentUserProfile();
      if (currentUser) {
        this.currentUserId = currentUser.uid;
        await this.loadInvitations();
      } else {
        this.showToast('Unable to load user information', 'danger');
      }
    } catch (error) {
      console.error('Error initializing modal:', error);
      this.showToast('Error loading invitations', 'danger');
    }
  }

  async loadInvitations() {
    try {
      const [received, sent] = await Promise.all([
        this.doctorService.getReceivedInvitations(this.currentUserId),
        this.doctorService.getSentInvitations(this.currentUserId)
      ]);
      this.receivedInvitations = received;
      this.sentInvitations = sent;
    } catch (error) {
      console.error('Error loading invitations:', error);
      this.showToast('Error loading invitations', 'danger');
    }
  }

  onSegmentChange() {
    // Data already loaded; nothing to do here.
  }

  async searchUsers(searchTerm: string) {
    if (!searchTerm || searchTerm.trim().length < 2) {
      this.showSearchDropdown = false;
      this.searchResults = [];
      return;
    }

    this.isSearching = true;
    try {
      const currentUser = await this.userService.getCurrentUserProfile();
      const results = await this.userService.searchApprovedDoctors(searchTerm, currentUser?.uid);
      this.searchResults = results;
      this.showSearchDropdown = true;
    } catch (error) {
      console.error('Error searching users:', error);
      this.showToast('Error searching users', 'danger');
    } finally {
      this.isSearching = false;
    }
  }

  selectUser(user: any) {
    this.selectedUser = user;
    this.inviteEmail = user.email;
    this.showSearchDropdown = false;
  }

  async sendInvitation() {
    if (!this.selectedUser) {
      this.showToast('Please select a doctor from the dropdown', 'warning');
      return;
    }

    try {
      this.isLoading = true;

      const currentUser = await this.userService.getCurrentUserProfile();
      if (!currentUser) {
        this.showToast('You must be logged in to send invitations', 'danger');
        return;
      }

      // Duplicate check before sending
      const duplicateCheck = await this.doctorService.checkDuplicateDoctorByEmail(
        currentUser.uid,
        this.selectedUser.email
      );

      if (duplicateCheck.isDuplicate) {
        const messages: Record<string, string> = {
          existing_doctor: `${duplicateCheck.details?.name} is already your connected doctor.`,
          pending_sent_invitation: `You already have a pending invitation sent to ${duplicateCheck.details?.name}.`,
          pending_received_invitation: `You already have a pending invitation from ${duplicateCheck.details?.name}.`
        };
        this.showToast(messages[duplicateCheck.type] || 'Duplicate invitation.', 'warning');
        return;
      }

      await this.doctorService.sendDoctorInvitationWithUser(
        currentUser,
        this.selectedUser,
        this.inviteMessage,
        this.selectedUser.specialty || ''
      );

      this.showToast('Invitation sent successfully', 'success');
      this.resetForm();
      await this.loadInvitations();
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      this.showToast(error?.message || 'Error sending invitation', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  resetForm() {
    this.inviteEmail = '';
    this.selectedUser = null;
    this.searchResults = [];
    this.showSearchDropdown = false;
    this.inviteMessage =
      'Hi! I would like you to be my healthcare provider on AllerAid. ' +
      'Please accept this invitation to manage my allergy information and emergency care.';
  }

  async acceptInvitation(invitation: any) {
    try {
      this.isLoading = true;
      await this.doctorService.acceptDoctorInvitationWithUser(
        invitation.id,
        this.currentUserId
      );
      this.showToast('Invitation accepted', 'success');
      await this.loadInvitations();
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      this.showToast(error?.message || 'Error accepting invitation', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async rejectInvitation(invitation: any) {
    try {
      this.isLoading = true;
      await this.doctorService.declineDoctorInvitationWithUser(
        invitation.id,
        this.currentUserId
      );
      this.showToast('Invitation declined', 'success');
      await this.loadInvitations();
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      this.showToast(error?.message || 'Error declining invitation', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async cancelInvitation(invitation: any) {
    const alert = await this.alertController.create({
      header: 'Cancel invitation',
      message: 'Are you sure you want to cancel this invitation?',
      buttons: [
        {
          text: 'Yes',
          handler: async () => {
            try {
              this.isLoading = true;
              await this.doctorService.cancelDoctorInvitationWithUser(
                invitation.id,
                this.currentUserId
              );
              this.showToast('Invitation cancelled', 'success');
              await this.loadInvitations();
            } catch (error: any) {
              console.error('Error cancelling invitation:', error);
              this.showToast(error?.message || 'Error cancelling invitation', 'danger');
            } finally {
              this.isLoading = false;
            }
          }
        },
         { text: 'No', role: 'cancel' }

      ]
    });
    await alert.present();
  }

  async closeModal() {
    await this.modalController.dismiss();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}