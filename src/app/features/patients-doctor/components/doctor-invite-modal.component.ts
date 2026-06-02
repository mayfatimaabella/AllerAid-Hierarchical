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
  inviteMessage: string = 'Hi! I would like you to be my healthcare provider on AllerAid. Please accept this invitation to manage my allergy information and emergency care.';
  
  // Search functionality
  searchResults: any[] = [];
  selectedUser: any = null;
  isSearching: boolean = false;
  showSearchDropdown: boolean = false;
  
  // Invitations lists
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
  ) { }

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
    // Data is already loaded, no need to reload on tab switch
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
      const results = await this.userService.searchUsers(searchTerm, currentUser?.uid);
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
        this.isLoading = false;
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
    } catch (error) {
      console.error('Error sending invitation:', error);
      this.showToast('Error sending invitation', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  resetForm() {
    this.inviteEmail = '';
    this.selectedUser = null;
    this.searchResults = [];
    this.showSearchDropdown = false;
    this.inviteMessage = 'Hi! I would like you to be my healthcare provider on AllerAid. Please accept this invitation to manage my allergy information and emergency care.';
  }

  async acceptInvitation(invitation: any) {
    try {
      this.isLoading = true;
      await this.doctorService.acceptDoctorInvitationWithUser(invitation.id, this.currentUserId);
      this.showToast('Invitation accepted', 'success');
      await this.loadInvitations();
    } catch (error) {
      console.error('Error accepting invitation:', error);
      this.showToast('Error accepting invitation', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async rejectInvitation(invitation: any) {
    try {
      this.isLoading = true;
      await this.doctorService.declineDoctorInvitationWithUser(invitation.id, this.currentUserId);
      this.showToast('Invitation rejected', 'success');
      await this.loadInvitations();
    } catch (error) {
      console.error('Error rejecting invitation:', error);
      this.showToast('Error rejecting invitation', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async cancelInvitation(invitation: any) {
    const alert = await this.alertController.create({
      header: 'Cancel Invitation',
      message: 'Are you sure you want to cancel this invitation?',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Yes',
          handler: async () => {
            try {
              this.isLoading = true;
              await this.doctorService.cancelDoctorInvitationWithUser(invitation.id, this.currentUserId);
              this.showToast('Invitation cancelled', 'success');
              await this.loadInvitations();
            } catch (error) {
              console.error('Error cancelling invitation:', error);
              this.showToast('Error cancelling invitation', 'danger');
            } finally {
              this.isLoading = false;
            }
          }
        }
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
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
