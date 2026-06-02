import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { DoctorService, DoctorInvitation } from '../../../core/services/doctor.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-patient-invite',
  templateUrl: './patient-invite.page.html',
  styleUrls: ['./patient-invite.page.scss'],
  standalone: false,
})
export class PatientInvitePage implements OnInit, OnDestroy {
  selectedSegment: 'invite' | 'received' | 'sent' = 'invite';
  
  // Search functionality
  searchEmail: string = '';
  searchResults: any[] = [];
  selectedUser: any = null;
  isSearching: boolean = false;
  showSearchDropdown: boolean = false;
  
  inviteMessage: string = '';
  isSubmitting: boolean = false;
  showSuccessMessage: boolean = false;
  currentUserId: string = '';

  // Invitations lists
  receivedInvitations: DoctorInvitation[] = [];
  sentInvitations: DoctorInvitation[] = [];

  private relationsSubscription?: any;

  constructor(
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private doctorService: DoctorService,
    private userService: UserService
  ) {}

  async ngOnInit() {
    const currentUser = await this.userService.getCurrentUserProfile();
    if (currentUser) {
      this.currentUserId = currentUser.uid;
      this.listenForAcceptedInvitations(currentUser.uid);
    }
    await this.loadInvitations();
  }

  ngOnDestroy(): void {
    this.relationsSubscription?.unsubscribe();
  }

  listenForAcceptedInvitations(userId: string): void {
    this.doctorService.listenForDoctorRelations(userId);
    this.relationsSubscription = this.doctorService.doctorRelations$.subscribe(relations => {
      relations.forEach((rel: any) => {
        if (!this.doctorService.hasBeenNotified(rel.doctorUid)) {
          this.showToast(`${rel.doctorName} accepted your patient invitation!`, 'success');
          this.doctorService.markAsNotified(rel.doctorUid);
          this.loadInvitations();
        }
      });
    });
  }

  async loadInvitations() {
    try {
      const currentUser = await this.userService.getCurrentUserProfile();
      if (currentUser) {
        this.receivedInvitations = await this.doctorService.getReceivedInvitations(currentUser.uid);
        this.sentInvitations = await this.doctorService.getSentInvitations(currentUser.uid);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      this.showToast('Error loading invitations', 'danger');
    }
  }

  onSegmentChange() {}

  async sendInvite() {
    if (!this.selectedUser) {
      await this.showToast('Please select a patient from the dropdown', 'warning');
      return;
    }

    try {
      this.isSubmitting = true;

      const currentUser = await this.userService.getCurrentUserProfile();
      if (!currentUser) {
        await this.showToast('You must be logged in to send invitations', 'danger');
        this.isSubmitting = false;
        return;
      }

      const duplicateCheck = await this.doctorService.checkDuplicateDoctorByEmail(currentUser.uid, this.selectedUser.email.trim());
      
      if (duplicateCheck.isDuplicate) {
        let alertMessage = '';
        let alertHeader = 'Duplicate Patient';
        
        switch (duplicateCheck.type) {
          case 'existing_doctor':
            alertMessage = `You already have ${duplicateCheck.details?.name || 'this person'} as a patient.`;
            break;
          case 'pending_sent_invitation':
            alertMessage = `You have already sent a patient invitation to ${duplicateCheck.details?.name || this.selectedUser.email}. Please wait for them to respond.`;
            break;
          case 'pending_received_invitation':
            alertMessage = `${duplicateCheck.details?.name || 'This person'} has already sent you a patient invitation. Please check your invitations.`;
            break;
          default:
            alertMessage = `This email is already associated with a patient relationship.`;
        }

        const alert = await this.alertController.create({
          header: alertHeader,
          message: alertMessage,
          buttons: ['OK']
        });
        
        await alert.present();
        this.isSubmitting = false;
        return;
      }

      await this.doctorService.sendDoctorInvitationWithUser(
        currentUser,
        this.selectedUser,
        this.inviteMessage
      );

      this.showSuccessMessage = true;
      await this.showToast('Invitation sent successfully!', 'success');
      
      // Clear form
      this.searchEmail = '';
      this.selectedUser = null;
      this.searchResults = [];
      this.showSearchDropdown = false;
      this.inviteMessage = '';

      await this.loadInvitations();
      this.selectedSegment = 'sent';

      setTimeout(() => {
        this.showSuccessMessage = false;
      }, 2500);

    } catch (error) {
      console.error('Error sending invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error sending invitation. Please try again.';
      await this.showToast(errorMessage, 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }

  async acceptInvitation(invitationId: string) {
    const alert = await this.alertController.create({
      header: 'Accept Patient Invitation',
      message: 'Are you sure you want to accept this patient invitation?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Accept',
          handler: async () => {
            try {
              const currentUser = await this.userService.getCurrentUserProfile();
              if (!currentUser) {
                throw new Error('No current user found');
              }
              
              const accepted = this.receivedInvitations.find(inv => inv.id === invitationId);
              const doctorName = accepted?.fromUserName || 'The doctor';

              await this.doctorService.acceptDoctorInvitationWithUser(invitationId, currentUser.uid);
              this.showToast(`${doctorName} is now your healthcare provider!`, 'success');
              await this.loadInvitations();
            } catch (error) {
              console.error('Error accepting invitation:', error);
              const errorMessage = error instanceof Error ? error.message : 'Error accepting invitation';
              this.showToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async declineInvitation(invitationId: string) {
    const alert = await this.alertController.create({
      header: 'Decline Patient Invitation',
      message: 'Are you sure you want to decline this patient invitation?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Decline',
          handler: async () => {
            try {
              await this.doctorService.declineDoctorInvitation(invitationId);
              this.showToast('Invitation declined', 'medium');
              await this.loadInvitations();
            } catch (error) {
              console.error('Error declining invitation:', error);
              this.showToast('Error declining invitation', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async cancelInvitation(invitationId: string) {
    const alert = await this.alertController.create({
      header: 'Cancel Invitation',
      message: 'Are you sure you want to cancel this invitation?',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Cancel Invitation',
          handler: async () => {
            try {
              await this.doctorService.cancelDoctorInvitation(invitationId);
              this.showToast('Invitation cancelled', 'medium');
              await this.loadInvitations();
            } catch (error) {
              console.error('Error cancelling invitation:', error);
              this.showToast('Error cancelling invitation', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  getInvitationStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warning';
      case 'accepted': return 'success';
      case 'declined': return 'danger';
      case 'cancelled': return 'medium';
      default: return 'medium';
    }
  }

  getPendingReceivedCount(): number {
    return this.receivedInvitations.filter(inv => inv.status === 'pending').length;
  }

  async searchForUsers(searchTerm: string) {
    this.searchEmail = searchTerm;
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      this.searchResults = [];
      this.showSearchDropdown = false;
      return;
    }

    try {
      this.isSearching = true;
      const results = await this.userService.searchUsers(searchTerm, this.currentUserId);
      this.searchResults = results;
      this.showSearchDropdown = results.length > 0;
    } catch (error) {
      console.error('Error searching users:', error);
      this.searchResults = [];
      this.showSearchDropdown = false;
    } finally {
      this.isSearching = false;
    }
  }

  selectUserFromDropdown(user: any) {
    this.selectedUser = user;
    this.searchEmail = user.email;
    this.showSearchDropdown = false;
  }

  clearSearch() {
    this.searchEmail = '';
    this.selectedUser = null;
    this.searchResults = [];
    this.showSearchDropdown = false;
  }

  async showToast(message: string, color: string = 'medium') {
    const toast = await this.toastController.create({
      message: message,
      duration: color === 'success' ? 3000 : 2500,
      color: color,
      position: 'top',
    });
    await toast.present();
  }
}

