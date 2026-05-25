import { Component, OnInit } from '@angular/core';
import { BuddyService } from '../../../core/services/buddy.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { FirebaseService } from '../../../core/services/firebase.service';
import { ToastController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { BuddyInvitationsModal } from '../components/buddy-invitations-modal.component';
import { environment } from '../../../../environments/environment';
import { doc, getDoc } from 'firebase/firestore';

@Component({
  selector: 'app-buddy',
  templateUrl: './buddy.page.html',
  styleUrls: ['./buddy.page.scss'],
  standalone: false,
})
export class BuddyPage implements OnInit {
  showDetailsModal = false;
  buddyToShowDetails: any = null;
  
  // Emergency resources
  hotlines: any[] = [];
  fallbackContact: any = null;
  hasEmergencyResources = false;
  
  // Loading states to prevent multiple calls
  private isLoadingBuddies = false;
  private isLoadingInvitations = false;

  showBuddyDetails(buddy: any) {
    this.buddyToShowDetails = buddy;
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.buddyToShowDetails = null;
  }
  
  buddies: any[] = [];
  filteredBuddies: any[] = [];
  searchTerm: string = '';
  showEditModal = false;
  showActionsModal = false;
  showDeleteModal = false;
  buddyToEdit: any = null;
  selectedBuddy: any = null;
  invitationCount: number = 0;

  constructor(
    private buddyService: BuddyService,
    private userService: UserService,
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private toastController: ToastController,
    private modalController: ModalController,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadInvitationCount();
    await this.loadEmergencyResources();
    this.loadBuddies();
  }

  async loadInvitationCount() {
    if (this.isLoadingInvitations) return; // Prevent multiple calls
    this.isLoadingInvitations = true;
    
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (currentUser) {
        const invitations = await this.buddyService.getReceivedInvitations(currentUser.uid);
        this.invitationCount = invitations.filter(inv => inv.status === 'pending').length;
      }
    } catch (error) {
      console.error('Error loading invitation count:', error);
      this.invitationCount = 0;
    } finally {
      this.isLoadingInvitations = false;
    }
  }

async loadBuddies() {
  if (this.isLoadingBuddies) return;
  this.isLoadingBuddies = true;

  try {
    const currentUser = await this.authService.waitForAuthInit();

    if (currentUser) {
      if (!environment.production) {
        console.log('Loading buddies for current user:', currentUser.uid);
      }

      const raw = await this.buddyService.getUserBuddies(currentUser.uid);

      // Map buddyName → firstName/lastName so the template works
      this.buddies = raw.map(b => ({
        ...b,
        firstName: b.firstName || b.buddyName?.split(' ')[0] || '',
        lastName:  b.lastName  || b.buddyName?.split(' ').slice(1).join(' ') || '',
        email:     b.email     || b.buddyEmail || '',
      }));

      if (!environment.production) {
        console.log('Loaded buddies from buddy page:', this.buddies);
      }
    } else {
      if (!environment.production) {
        console.log('No current user found - redirecting to login');
      }

      this.buddies = [];

      const toast = await this.toastController.create({
        message: 'Please log in to view your buddies',
        duration: 3000,
        color: 'warning'
      });
      await toast.present();

      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 1000);
    }

    this.filteredBuddies = this.buddies;
  } finally {
    this.isLoadingBuddies = false;
  }
}

  async openInvitationsModal() {
    const modal = await this.modalController.create({
      component: BuddyInvitationsModal,
      componentProps: {}
    });

    modal.onDidDismiss().then((result) => {
      if (result.data) {
        // Refresh buddy list if a relation was accepted or invitation was sent
        if (result.data.action === 'accepted') {
          this.loadBuddies(); // New buddy relation created
        }
        // Always refresh invitation count if something changed
        if (result.data.invitationChanged) {
          this.loadInvitationCount(); // Update badge count
        }
      }
    });

    return await modal.present();
  }

  closeEditModal() {
    this.showEditModal = false;
    this.buddyToEdit = null;
  }

  openBuddyActions(buddy: any) {
    this.selectedBuddy = buddy;
    this.showActionsModal = true;
  }

  closeActionsModal() {
    this.showActionsModal = false;
    this.selectedBuddy = null;
  }

  onEditBuddy(buddy: any) {
    this.closeActionsModal();
    this.buddyToEdit = buddy;
    this.showEditModal = true;
  }

  onSaveEditBuddy(editedBuddy: any) {
    // Update the connected user's profile with the changes
    // The buddy's contact info is stored in the user's profile, so we update the user record
    if (!editedBuddy.connectedUserId) {
      console.error('No connectedUserId found in buddy object');
      return;
    }

    // Prepare profile updates for the connected user
    const profileUpdates = {
      firstName: editedBuddy.firstName,
      lastName: editedBuddy.lastName,
      fullName: `${editedBuddy.firstName} ${editedBuddy.lastName}`.trim(),
      email: editedBuddy.email,
      phone: editedBuddy.contactNumber || editedBuddy.contact
    };

    this.userService.updateUserProfile(editedBuddy.connectedUserId, profileUpdates)
      .then(async () => {
        // Clear cache so buddy list refreshes with latest data
        this.userService.clearUserProfileCache(editedBuddy.connectedUserId);
        
        // Update local array with the changes
        const index = this.buddies.findIndex(b => b.id === editedBuddy.id);
        if (index !== -1) {
          this.buddies[index] = editedBuddy;
          this.filteredBuddies = [...this.buddies]; // Update filtered array
        }
        this.closeEditModal();
        
        // Show success toast
        const toast = await this.toastController.create({
          message: `${editedBuddy.firstName} ${editedBuddy.lastName}'s contact information updated successfully!`,
          duration: 2000,
          color: 'success'
        });
        await toast.present();
        
        // Reload buddies to ensure we have the latest data
        await this.loadBuddies();
      })
      .catch(async (error) => {
        console.error('Error updating buddy contact information:', error);
        // Show error toast
        const toast = await this.toastController.create({
          message: 'Failed to update contact information. Please try again.',
          duration: 3000,
          color: 'danger'
        });
        await toast.present();
        // Reload to ensure consistency
        await this.loadBuddies();
      });
  }

  onDeleteBuddy(buddy: any) {
    this.closeActionsModal();
    this.buddyToEdit = buddy;
    this.showDeleteModal = true;
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.buddyToEdit = null;
  }

  async onConfirmDeleteBuddy(buddy: any) {
    try {
      await this.buddyService.deleteBuddy(buddy); // Pass the full buddy object, not just the ID
      this.showDeleteModal = false;
      this.buddyToEdit = null;
      
      // Update local arrays instead of reloading from server
      this.buddies = this.buddies.filter(b => b.id !== buddy.id);
      this.filteredBuddies = this.filteredBuddies.filter(b => b.id !== buddy.id);
      
      // Show success toast
      const toast = await this.toastController.create({
        message: `${buddy.firstName} ${buddy.lastName} has been removed from your buddy list.`,
        duration: 3000,
        color: 'success'
      });
      await toast.present();
    } catch (error) {
      // Handle error (e.g., show a toast)
      console.error('Error deleting buddy:', error);
      
      // Show error toast
      const toast = await this.toastController.create({
        message: 'Failed to delete buddy. Please try again.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
      
      // Fallback to reload if delete fails locally
      await this.loadBuddies();
    }
  }

  searchBuddy() {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredBuddies = this.buddies;
    } else {
      this.filteredBuddies = this.buddies.filter(buddy => {
        const fullName = `${buddy.firstName} ${buddy.lastName}`.toLowerCase();
        const email = (buddy.email || '').toLowerCase();
        const relationship = (buddy.relationship || '').toLowerCase();
        const contact = (buddy.contactNumber || '').toLowerCase();
        
        return fullName.includes(term) || 
               email.includes(term) ||
               relationship.includes(term) || 
               contact.includes(term);
      });
    }
  }

  private async loadEmergencyResources(): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      const db = this.firebaseService.getDb();
      const medicalRef = doc(db, `users/${currentUser.uid}/medical/info`);
      const medicalSnap = await getDoc(medicalRef);

      if (medicalSnap.exists()) {
        const data = medicalSnap.data();
        const fallbackSetup = data['fallbackEmergencySetup'];

        if (fallbackSetup) {
          if (fallbackSetup.trustedContact) {
            this.fallbackContact = fallbackSetup.trustedContact;
          }
          if (fallbackSetup.enabledHotlines && fallbackSetup.enabledHotlines.length > 0) {
            this.hotlines = fallbackSetup.enabledHotlines;
          }
        }
      }

      this.hasEmergencyResources = !!(this.fallbackContact?.name || this.hotlines.length > 0);
    } catch (error) {
      console.error('Error loading emergency resources:', error);
    }
  }

  callNumber(number: string): void {
    if (!number) return;
    try {
      window.open(`tel:${number}`, '_system');
    } catch {
      window.open(`tel:${number}`);
    }
  }

  async handleRefresh(event: any) {
    try {
      await this.loadBuddies();
      await this.loadInvitationCount();
      await this.loadEmergencyResources();
      this.searchBuddy();
    } catch (error) {
      console.error('Error refreshing buddies:', error);
    } finally {
      event.target.complete();
    }
  }
}
