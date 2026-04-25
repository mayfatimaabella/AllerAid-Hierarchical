import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { AuthService } from '../../../../core/services/auth.service';
import { BuddyService } from '../../../../core/services/buddy.service';
import { UserService } from '../../../../core/services/user.service';
import { FirebaseService } from '../../../../core/services/firebase.service';

interface BuddySetupEntry {
  fullName: string;
  relationship: string;
  contactNumber: string;
  email: string;
}

type InviteStatus = 'sent' | 'already_exists' | 'failed' | 'skipped';

@Component({
  selector: 'app-buddy-setup-onboarding',
  templateUrl: './buddy-setup-onboarding.page.html',
  styleUrls: ['./buddy-setup-onboarding.page.scss'],
  standalone: false,
})
export class BuddySetupOnboardingPage implements OnInit {
  relationships = ['Friend', 'Roommate', 'Family', 'Coworker', 'Partner', 'Other'];

  primaryBuddy: BuddySetupEntry = {
    fullName: '',
    relationship: '',
    contactNumber: '',
    email: ''
  };

  secondaryBuddy: BuddySetupEntry = {
    fullName: '',
    relationship: '',
    contactNumber: '',
    email: ''
  };

  includeSecondary = false;
  isLoading = true;
  isSaving = false;
  isSendingPrimaryInvite = false;
  isSendingSecondaryInvite = false;
  primaryInviteStatus: InviteStatus | null = null;
  secondaryInviteStatus: InviteStatus | null = null;

  private db;

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService,
    private buddyService: BuddyService,
    private firebaseService: FirebaseService,
    private toastController: ToastController
  ) {
    this.db = this.firebaseService.getDb();
  }

  async ngOnInit(): Promise<void> {
    await this.loadExistingSetup();
  }

  private async loadExistingSetup(): Promise<void> {
    try {
      this.isLoading = true;
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        return;
      }

      const medicalRef = doc(this.db, 'users', currentUser.uid, 'medical', 'info');
      const snap = await getDoc(medicalRef);
      if (!snap.exists()) {
        return;
      }

      const data = snap.data();
      const existing = data?.['buddySetupOnboarding'];
      if (!existing) {
        return;
      }

      if (existing.primaryBuddy) {
        this.primaryBuddy = {
          fullName: existing.primaryBuddy.fullName || '',
          relationship: existing.primaryBuddy.relationship || '',
          contactNumber: existing.primaryBuddy.contactNumber || '',
          email: existing.primaryBuddy.email || ''
        };
        if (existing.primaryBuddy.inviteStatus) {
          this.primaryInviteStatus = existing.primaryBuddy.inviteStatus as InviteStatus;
        }
      }

      if (existing.secondaryBuddy) {
        this.includeSecondary = true;
        this.secondaryBuddy = {
          fullName: existing.secondaryBuddy.fullName || '',
          relationship: existing.secondaryBuddy.relationship || '',
          contactNumber: existing.secondaryBuddy.contactNumber || '',
          email: existing.secondaryBuddy.email || ''
        };
        if (existing.secondaryBuddy.inviteStatus) {
          this.secondaryInviteStatus = existing.secondaryBuddy.inviteStatus as InviteStatus;
        }
      }
    } catch (error) {
      console.error('Error loading buddy setup onboarding:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async saveAndContinue(): Promise<void> {
    if (!this.isPrimaryValid()) {
      await this.showToast('Primary buddy is required: name, relationship, contact number (exactly 11 digits), and valid email.', 'warning');
      return;
    }

    if (this.includeSecondary && !this.isSecondaryValid()) {
      await this.showToast('Secondary buddy must include name, relationship, contact number (exactly 11 digits), and valid email.', 'warning');
      return;
    }

    try {
      this.isSaving = true;
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        await this.showToast('You must be logged in to continue.', 'danger');
        return;
      }

      const currentUserProfile = await this.userService.getCurrentUserProfile();
      if (!currentUserProfile) {
        await this.showToast('Unable to load your profile. Please try again.', 'danger');
        return;
      }

      this.primaryInviteStatus = await this.ensureInvitationStatus(
        this.primaryBuddy,
        currentUserProfile,
        true,
        this.primaryInviteStatus
      );

      if (this.includeSecondary) {
        this.secondaryInviteStatus = await this.ensureInvitationStatus(
          this.secondaryBuddy,
          currentUserProfile,
          false,
          this.secondaryInviteStatus
        );
      } else {
        this.secondaryInviteStatus = 'skipped';
      }

      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          buddySetupOnboarding: {
            primaryBuddy: {
              ...this.primaryBuddy,
              inviteStatus: this.primaryInviteStatus
            },
            secondaryBuddy: this.includeSecondary
              ? { ...this.secondaryBuddy, inviteStatus: this.secondaryInviteStatus }
              : null,
            updatedAt: new Date()
          }
        },
        { merge: true }
      );

      await this.userService.updateProfileDetails(currentUser.uid, {
        emergencyContactName: this.primaryBuddy.fullName,
        emergencyContactPhone: this.primaryBuddy.contactNumber
      });

      await this.userService.markAllergyOnboardingCompleted(currentUser.uid);

      const hasFailed = [this.primaryInviteStatus, this.secondaryInviteStatus].includes('failed');

      if (hasFailed) {
        await this.showToast('Buddy setup saved, but some invitations could not be sent.', 'warning');
      } else {
        await this.showToast('Buddy setup complete.', 'success');
      }

      await this.router.navigate(['/tabs/home']);
    } catch (error) {
      console.error('Error saving buddy setup onboarding:', error);
      await this.showToast('Failed to save buddy setup. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  private async sendInvitationForBuddy(entry: BuddySetupEntry, currentUserProfile: any, isPrimary: boolean): Promise<InviteStatus> {
    try {
      const normalizedEmail = (entry.email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        await this.showToast(`${isPrimary ? 'Primary' : 'Secondary'} buddy email is required.`, 'warning');
        return 'failed';
      }

      // Skip duplicate check during onboarding to avoid Firestore permission issues
      // The Cloud Function will handle duplicate detection server-side if needed

      const inviteMessage = `Hi ${entry.fullName}, I added you as my ${entry.relationship.toLowerCase()} emergency buddy in AllerAid. Please accept this invitation so you can be notified and respond during emergencies.`;

      // Use Cloud Function to send invitation (has admin privileges to bypass permission issues)
      await this.buddyService.sendBuddyInvitationViaFunction(currentUserProfile, normalizedEmail, inviteMessage);
      return 'sent';
    } catch (error) {
      console.error('Error sending buddy invitation:', error);
      return 'failed';
    }
  }

  async sendPrimaryInvite(): Promise<void> {
    if (!this.hasRequiredValues(this.primaryBuddy)) {
      await this.showToast('Primary buddy details must be complete before sending invitation.', 'warning');
      return;
    }

    try {
      this.isSendingPrimaryInvite = true;
      const currentUserProfile = await this.userService.getCurrentUserProfile();
      if (!currentUserProfile) {
        await this.showToast('Unable to load your profile. Please try again.', 'danger');
        return;
      }

      this.primaryInviteStatus = await this.sendInvitationForBuddy(this.primaryBuddy, currentUserProfile, true);
      if (this.primaryInviteStatus === 'sent') {
        await this.showToast('Primary buddy invitation sent.', 'success');
      }
    } finally {
      this.isSendingPrimaryInvite = false;
    }
  }

  async sendSecondaryInvite(): Promise<void> {
    if (!this.hasRequiredValues(this.secondaryBuddy)) {
      await this.showToast('Secondary buddy details must be complete before sending invitation.', 'warning');
      return;
    }

    try {
      this.isSendingSecondaryInvite = true;
      const currentUserProfile = await this.userService.getCurrentUserProfile();
      if (!currentUserProfile) {
        await this.showToast('Unable to load your profile. Please try again.', 'danger');
        return;
      }

      this.secondaryInviteStatus = await this.sendInvitationForBuddy(this.secondaryBuddy, currentUserProfile, false);
      if (this.secondaryInviteStatus === 'sent') {
        await this.showToast('Secondary buddy invitation sent.', 'success');
      }
    } finally {
      this.isSendingSecondaryInvite = false;
    }
  }

  private async ensureInvitationStatus(
    entry: BuddySetupEntry,
    currentUserProfile: any,
    isPrimary: boolean,
    existingStatus: InviteStatus | null
  ): Promise<InviteStatus> {
    if (existingStatus === 'sent' || existingStatus === 'already_exists') {
      return existingStatus;
    }

    return this.sendInvitationForBuddy(entry, currentUserProfile, isPrimary);
  }

  getInviteButtonLabel(status: InviteStatus | null): string {
    if (status === 'sent') return 'Sent';
    if (status === 'already_exists') return 'Already Connected';
    return 'Send Invite';
  }

  isInviteButtonDisabled(status: InviteStatus | null, isSending: boolean): boolean {
    if (isSending) return true;
    return status === 'sent' || status === 'already_exists';
  }

  private isPrimaryValid(): boolean {
    return this.hasRequiredValues(this.primaryBuddy);
  }

  private isSecondaryValid(): boolean {
    return this.hasRequiredValues(this.secondaryBuddy);
  }

  private hasRequiredValues(entry: BuddySetupEntry): boolean {
    const normalizedContact = this.normalizeContactNumber(entry.contactNumber);
    return !!entry.fullName.trim()
      && !!entry.relationship
      && this.isValidContactNumber(normalizedContact)
      && this.isValidEmail(entry.email);
  }

  onContactInput(event: any, target: 'primary' | 'secondary'): void {
    const rawValue = event?.detail?.value ?? '';
    const normalizedValue = this.normalizeContactNumber(rawValue);

    if (target === 'primary') {
      this.primaryBuddy.contactNumber = normalizedValue;
    } else {
      this.secondaryBuddy.contactNumber = normalizedValue;
    }

    if (event?.target) {
      event.target.value = normalizedValue;
    }
  }

  private normalizeContactNumber(value: string): string {
    return (value || '').replace(/\D/g, '').slice(0, 11);
  }

  private isValidContactNumber(value: string): boolean {
    return /^\d{11}$/.test(value);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
  }

  private getDuplicateMessage(duplicateCheck: { type: string; details?: any }, fallbackEmail: string): string {
    switch (duplicateCheck.type) {
      case 'existing_buddy':
        return `You already have ${duplicateCheck.details?.name || fallbackEmail} as a buddy.`;
      case 'pending_sent_invitation':
        return `You already sent a buddy invitation to ${duplicateCheck.details?.name || fallbackEmail}.`;
      case 'pending_received_invitation':
        return `${duplicateCheck.details?.name || 'This person'} already invited you. Check your pending invitations.`;
      case 'legacy_buddy':
        return `This email is already in your buddy contacts.`;
      default:
        return 'This email is already associated with a buddy relationship.';
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2600,
      color,
    });
    await toast.present();
  }
}
