import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, ToastController } from '@ionic/angular';
import {
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { AuthService } from '../../../../core/services/auth.service';
import { BuddyService } from '../../../../core/services/buddy.service';
import { UserService } from '../../../../core/services/user.service';
import { FirebaseService } from '../../../../core/services/firebase.service';
import { Subscription } from 'rxjs';

interface BuddySetupEntry {
  fullName: string;
  relationship: string;
  contactNumber: string;
  email: string;
}

interface ExternalBuddyInvite {
  email: string;
  phone: string;
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

  buddySearchEmail = '';
  foundBuddy: any = null;
  isSearchingBuddy = false;
  isExternalBuddy = false;
  primaryRelationship = '';

  externalInvite: ExternalBuddyInvite = {
    email: '',
    phone: ''
  };

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

  private backButtonSubscription?: Subscription;
  private db;

  constructor(
    private router: Router,
    private platform: Platform,
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

  ionViewDidEnter(): void {
    this.enableBackNavigationBlock();
  }

  ionViewWillLeave(): void {
    this.disableBackNavigationBlock();
  }

  ngOnDestroy(): void {
    this.disableBackNavigationBlock();
  }

  private onPopState = (): void => {
    history.pushState(null, '', window.location.href);
  };

  private enableBackNavigationBlock(): void {
    this.disableBackNavigationBlock();

    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(9999, () => {
      // Lock onboarding to forward-only navigation
    });

    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', this.onPopState);
  }

  private disableBackNavigationBlock(): void {
    this.backButtonSubscription?.unsubscribe();
    this.backButtonSubscription = undefined;
    window.removeEventListener('popstate', this.onPopState);
  }

  async goBack(): Promise<void> {
    this.disableBackNavigationBlock();
    await this.router.navigate(['/emergency-instructions-onboarding'], { replaceUrl: true });
  }

  private async loadExistingSetup(): Promise<void> {
    try {
      this.isLoading = true;

      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      const medicalRef = doc(this.db, 'users', currentUser.uid, 'medical', 'info');
      const snap = await getDoc(medicalRef);

      if (!snap.exists()) return;

      const data = snap.data();
      const existing = data?.['buddySetupOnboarding'];

      if (!existing) return;

      if (existing.primaryBuddy) {
        this.primaryBuddy = {
          fullName: existing.primaryBuddy.fullName || '',
          relationship: existing.primaryBuddy.relationship || '',
          contactNumber: existing.primaryBuddy.contactNumber || '',
          email: existing.primaryBuddy.email || ''
        };

        this.buddySearchEmail = this.primaryBuddy.email;
        this.primaryRelationship = this.primaryBuddy.relationship;

        if (existing.primaryBuddy.inviteStatus) {
          this.primaryInviteStatus = existing.primaryBuddy.inviteStatus as InviteStatus;
        }
      }

      if (existing.externalInvite) {
        this.externalInvite = {
          email: existing.externalInvite.email || '',
          phone: existing.externalInvite.phone || ''
        };

        this.isExternalBuddy = true;
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

  async searchBuddyByEmail(): Promise<void> {
    const email = this.buddySearchEmail.trim().toLowerCase();

    if (!this.isValidEmail(email)) {
      await this.showToast('Please enter a valid email.', 'warning');
      return;
    }

    try {
      this.isSearchingBuddy = true;
      this.foundBuddy = null;
      this.isExternalBuddy = false;

      const currentUser = await this.authService.waitForAuthInit();

      if (currentUser?.email?.toLowerCase() === email) {
        await this.showToast('You cannot add yourself as your buddy.', 'warning');
        return;
      }

      // Do not query users collection from client (blocked by security rules).
      // Prepare invite by email; server-side function validates whether target exists.
      const fallbackFirstName = this.deriveNameFromEmail(email);
      this.foundBuddy = {
        uid: '',
        email,
        firstName: fallbackFirstName,
        lastName: ''
      };

      this.primaryBuddy.email = email;
      this.primaryBuddy.fullName = fallbackFirstName;
      this.primaryBuddy.contactNumber = '';

      await this.showToast('Buddy email ready. Set relationship and send request.', 'success');
    } catch (error) {
      console.error('Error searching buddy:', error);
      await this.showToast('Could not search buddy. Please try again.', 'danger');
    } finally {
      this.isSearchingBuddy = false;
    }
  }

  async sendPrimaryInvite(): Promise<void> {
    if (!this.foundBuddy) {
      await this.showToast('Please search and select a buddy first.', 'warning');
      return;
    }

    if (!this.primaryRelationship) {
      await this.showToast('Please select your relationship.', 'warning');
      return;
    }

    try {
      this.isSendingPrimaryInvite = true;

      const currentUserProfile = await this.userService.getCurrentUserProfile();

      if (!currentUserProfile) {
        await this.showToast('Unable to load your profile.', 'danger');
        return;
      }

      this.primaryBuddy.relationship = this.primaryRelationship;
      this.primaryBuddy.email = this.buddySearchEmail.trim().toLowerCase();

      const inviteMessage =
        `Hi ${this.primaryBuddy.fullName}, I added you as my ${this.primaryRelationship.toLowerCase()} emergency buddy in AllerAid. Please accept this request so you can be notified during emergencies.`;

      await this.buddyService.sendBuddyInvitationViaFunction(
        currentUserProfile,
        this.primaryBuddy.email,
        inviteMessage
      );

      this.primaryInviteStatus = 'sent';
      await this.showToast('Buddy request sent.', 'success');
    } catch (error) {
      console.error('Error sending buddy request:', error);
      this.primaryInviteStatus = 'failed';

      if (this.isNotFoundInviteError(error)) {
        this.foundBuddy = null;
        this.isExternalBuddy = true;
        this.externalInvite.email = this.primaryBuddy.email || this.buddySearchEmail.trim().toLowerCase();
        await this.showToast('Buddy is not on AllerAid yet. You can send an invite link instead.', 'warning');
      } else {
        await this.showToast('Could not send buddy request.', 'danger');
      }
    } finally {
      this.isSendingPrimaryInvite = false;
    }
  }

  async sendExternalInviteLink(): Promise<void> {
    const email = this.externalInvite.email.trim().toLowerCase();
    const phone = this.externalInvite.phone.trim();

    if (!this.isValidEmail(email) && !phone) {
      await this.showToast('Enter an email or phone number.', 'warning');
      return;
    }

    try {
      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in.', 'danger');
        return;
      }

      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          buddySetupOnboarding: {
            externalInvite: {
              email,
              phone,
              status: 'pending_signup',
              createdAt: new Date()
            },
            updatedAt: new Date()
          }
        },
        { merge: true }
      );

      await this.showToast('Invite link saved/sent.', 'success');
    } catch (error) {
      console.error('Error saving external invite:', error);
      await this.showToast('Could not save invite.', 'danger');
    }
  }

  async saveAndContinue(): Promise<void> {
    if (!this.foundBuddy && !this.isExternalBuddy) {
      await this.showToast('Please search for a buddy first.', 'warning');
      return;
    }

    if (this.foundBuddy && this.primaryInviteStatus !== 'sent') {
        await this.sendPrimaryInvite();
        
        const inviteWasSent = this.primaryInviteStatus as InviteStatus;
        
        if (inviteWasSent !== 'sent') {
            return;
    }
    }



    if (this.isExternalBuddy) {
      await this.sendExternalInviteLink();
    }

    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in to continue.', 'danger');
        return;
      }

      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          buddySetupOnboarding: {
            primaryBuddy: this.foundBuddy
              ? {
                  ...this.primaryBuddy,
                  relationship: this.primaryRelationship,
                  buddyUid: this.foundBuddy.uid,
                  inviteStatus: this.primaryInviteStatus
                }
              : null,

            externalInvite: this.isExternalBuddy
              ? {
                  email: this.externalInvite.email.trim().toLowerCase(),
                  phone: this.externalInvite.phone.trim(),
                  status: 'pending_signup'
                }
              : null,

            secondaryBuddy: this.includeSecondary
              ? {
                  ...this.secondaryBuddy,
                  inviteStatus: this.secondaryInviteStatus
                }
              : null,

            updatedAt: new Date()
          }
        },
        { merge: true }
      );

      if (this.foundBuddy) {
        await this.userService.updateProfileDetails(currentUser.uid, {
          emergencyContactName: this.primaryBuddy.fullName,
          emergencyContactPhone: this.primaryBuddy.contactNumber
        });
      }

      await this.userService.markAllergyOnboardingCompleted(currentUser.uid);

      await this.showToast('Buddy setup complete.', 'success');
      await this.router.navigate(['/tabs/home'], { replaceUrl: true });
    } catch (error) {
      console.error('Error saving buddy setup onboarding:', error);
      await this.showToast('Failed to save buddy setup. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async sendSecondaryInvite(): Promise<void> {
    if (!this.hasRequiredValues(this.secondaryBuddy)) {
      await this.showToast(
        'Secondary buddy details must be complete before sending invitation.',
        'warning'
      );
      return;
    }

    try {
      this.isSendingSecondaryInvite = true;

      const currentUserProfile = await this.userService.getCurrentUserProfile();

      if (!currentUserProfile) {
        await this.showToast('Unable to load your profile. Please try again.', 'danger');
        return;
      }

      this.secondaryInviteStatus = await this.sendInvitationForBuddy(
        this.secondaryBuddy,
        currentUserProfile,
        false
      );

      if (this.secondaryInviteStatus === 'sent') {
        await this.showToast('Secondary buddy invitation sent.', 'success');
      }
    } finally {
      this.isSendingSecondaryInvite = false;
    }
  }

  private async sendInvitationForBuddy(
    entry: BuddySetupEntry,
    currentUserProfile: any,
    isPrimary: boolean
  ): Promise<InviteStatus> {
    try {
      const normalizedEmail = (entry.email || '').trim().toLowerCase();

      if (!normalizedEmail) {
        await this.showToast(
          `${isPrimary ? 'Primary' : 'Secondary'} buddy email is required.`,
          'warning'
        );
        return 'failed';
      }

      const inviteMessage =
        `Hi ${entry.fullName}, I added you as my ${entry.relationship.toLowerCase()} emergency buddy in AllerAid. Please accept this invitation so you can be notified and respond during emergencies.`;

      await this.buddyService.sendBuddyInvitationViaFunction(
        currentUserProfile,
        normalizedEmail,
        inviteMessage
      );

      return 'sent';
    } catch (error) {
      console.error('Error sending buddy invitation:', error);
      return 'failed';
    }
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

  private hasRequiredValues(entry: BuddySetupEntry): boolean {
    const normalizedContact = this.normalizeContactNumber(entry.contactNumber);

    return !!entry.fullName.trim()
      && !!entry.relationship
      && this.isValidContactNumber(normalizedContact)
      && this.isValidEmail(entry.email);
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

  private deriveNameFromEmail(email: string): string {
    const localPart = (email || '').split('@')[0] || 'Buddy';
    return localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase())
      .trim();
  }

  private isNotFoundInviteError(error: any): boolean {
    const code = (error?.code || '').toString().toLowerCase();
    const message = (error?.message || '').toString().toLowerCase();
    return code.includes('not-found') || message.includes('not found') || message.includes('no user found');
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2600,
      color,
    });

    await toast.present();
  }
}