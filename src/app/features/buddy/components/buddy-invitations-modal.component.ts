import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController, AlertController } from '@ionic/angular';
import { BuddyService, BuddyInvitation } from '../../../core/services/buddy.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-buddy-invitations-modal',
  templateUrl: './buddy-invitations-modal.component.html',
  styleUrls: ['./buddy-invitations-modal.component.scss'],
  standalone: false,
})
export class BuddyInvitationsModal implements OnInit {

  selectedSegment: 'invite' | 'received' | 'sent' = 'invite';
  
  // Send invitation form
  inviteEmail: string = '';
  inviteMessage: string = 'Hi! I\'d like you to be my emergency buddy. This will help us stay connected during allergy emergencies.';
  
  // Search functionality
  searchResults: any[] = [];
  selectedUser: any = null;
  isSearching: boolean = false;
  showSearchDropdown: boolean = false;
  
  // Invitations lists
  receivedInvitations: BuddyInvitation[] = [];
  sentInvitations: BuddyInvitation[] = [];
  
  isLoading: boolean = false;
  currentUserId: string = '';

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private alertController: AlertController,
    private buddyService: BuddyService,
    private userService: UserService
  ) { }

  async ngOnInit() {
    const currentUser = await this.userService.getCurrentUserProfile();
    if (currentUser) {
      this.currentUserId = currentUser.uid;
    }
    await this.loadInvitations();
  }

  async loadInvitations() {
    try {
      const currentUser = await this.userService.getCurrentUserProfile();
      if (currentUser) {
        // Service already handles fallback logic (userId -> email), so just call once
        this.receivedInvitations = await this.buddyService.getReceivedInvitations(currentUser.uid);
        this.sentInvitations = await this.buddyService.getSentInvitations(currentUser.uid);
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
      this.showToast('Error loading invitations', 'danger');
    }
  }

  onSegmentChange() {
    // Data is already loaded, no need to reload on tab switch
    // Only refresh if explicitly needed (handled by individual action handlers)
  }

  async sendInvitation() {
    if (!this.selectedUser) {
      this.showToast('Please select a user from the dropdown', 'warning');
      return;
    }

    try {
      this.isLoading = true;

      // Get current user profile first
      const currentUser = await this.userService.getCurrentUserProfile();
      if (!currentUser) {
        this.showToast('You must be logged in to send invitations', 'danger');
        this.isLoading = false;
        return;
      }

      // Check for duplicate buddy relationships FIRST
      const duplicateCheck = await this.buddyService.checkDuplicateBuddyByEmail(currentUser.uid, this.selectedUser.email.trim());
      
      if (duplicateCheck.isDuplicate) {
        let alertMessage = '';
        let alertHeader = 'Duplicate Buddy';
        
        switch (duplicateCheck.type) {
          case 'existing_buddy':
            alertMessage = `You already have ${duplicateCheck.details?.name || 'this person'} as a buddy.`;
            break;
          case 'pending_sent_invitation':
            alertMessage = `You have already sent a buddy invitation to ${duplicateCheck.details?.name || this.selectedUser.email}. Please wait for them to respond.`;
            break;
          case 'pending_received_invitation':
            alertMessage = `${duplicateCheck.details?.name || 'This person'} has already sent you a buddy invitation. Please check your invitations.`;
            break;
          case 'legacy_buddy':
            alertMessage = `You already have ${duplicateCheck.details?.name || 'this person'} as a buddy in your contacts.`;
            break;
          default:
            alertMessage = `This email is already associated with a buddy relationship.`;
        }

        const alert = await this.alertController.create({
          header: alertHeader,
          message: alertMessage,
          buttons: ['OK']
        });
        
        await alert.present();
        this.isLoading = false;
        return; // Block the invitation
      }

      // Send the invitation with current user data
      await this.buddyService.sendBuddyInvitationWithUser(
        currentUser,
        this.selectedUser,
        this.inviteMessage
      );

      this.showToast('Invitation sent successfully!', 'success');
      
      // Clear form
      this.inviteEmail = '';
      this.selectedUser = null;
      this.searchResults = [];
      this.showSearchDropdown = false;
      this.inviteMessage = 'Hi! I\'d like you to be my emergency buddy. This will help us stay connected during allergy emergencies.';
      
      // Refresh sent invitations
      await this.loadInvitations();
      
      // Notify parent that invitation count may have changed
      this.dismiss(true, 'sent');
      
      // Switch to sent tab to show the sent invitation
      this.selectedSegment = 'sent';

    } catch (error) {
      console.error('Error sending invitation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error sending invitation. Please try again.';
      this.showToast(errorMessage, 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async acceptInvitation(invitationId: string) {
    const alert = await this.alertController.create({
      header: 'Accept Buddy Invitation',
      message: 'Are you sure you want to accept this buddy invitation?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Accept',
          handler: async () => {
            try {
              // Get current user profile first
              const currentUser = await this.userService.getCurrentUserProfile();
              if (!currentUser) {
                throw new Error('No current user found');
              }
              
              // Pass the current user to the accept method
              await this.buddyService.acceptBuddyInvitationWithUser(invitationId, currentUser.uid);
              this.showToast('Buddy invitation accepted!', 'success');
              await this.loadInvitations();
              this.dismiss(true, 'accepted'); // Close modal and refresh parent with action type
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
      header: 'Decline Buddy Invitation',
      message: 'Are you sure you want to decline this buddy invitation?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Decline',
          handler: async () => {
            try {
              await this.buddyService.declineBuddyInvitation(invitationId);
              this.showToast('Invitation declined', 'medium');
              await this.loadInvitations();
              this.dismiss(true, 'declined'); // Notify parent of change
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
              await this.buddyService.cancelBuddyInvitation(invitationId);
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

  getPendingSentCount(): number {
    return this.sentInvitations.filter(inv => inv.status === 'pending').length;
  }

  async searchForUsers(searchTerm: string) {
    this.inviteEmail = searchTerm;
    
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
    this.inviteEmail = user.email;
    this.showSearchDropdown = false;
  }

  clearSearch() {
    this.inviteEmail = '';
    this.selectedUser = null;
    this.searchResults = [];
    this.showSearchDropdown = false;
  }

  async showToast(message: string, color: string = 'medium') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'top'
    });
    await toast.present();
  }

  dismiss(refreshNeeded: boolean = false, actionType?: string) {
    this.modalController.dismiss({
      refreshNeeded: refreshNeeded,
      invitationChanged: actionType ? true : false, // Flag for parent to refresh invitation count
      action: actionType // Type of action that occurred (accepted, declined, sent, etc.)
    });
  }
}
