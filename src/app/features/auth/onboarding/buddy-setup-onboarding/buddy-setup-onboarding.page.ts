import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, ToastController } from '@ionic/angular';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

interface FallbackContact {
  name: string;
  phone: string;
  customHotline: string;
}

interface Hotline {
  name: string;
  number: string;
  enabled: boolean;
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
  showFallback = false;

  fallbackContact: FallbackContact = {
  name: '',
  phone: '',
  customHotline: ''
};

hotlines: Hotline[] = [
  { name: 'Emergency (PH)', number: '911',        enabled: true  },
  { name: 'Red Cross PH',   number: '143',        enabled: true  },
  { name: 'DOH Hotline',    number: '1555',       enabled: false },
  { name: 'NDRRMC',         number: '911',        enabled: false },
];

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
  private invitationUnsubscribe?: () => void;
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

    const currentUser = await this.authService.waitForAuthInit();
  if (currentUser) {
    await this.listenForPrimaryInviteAcceptance(currentUser.uid);
    this.buddyService.listenForBuddyRelations(currentUser.uid);
  }

    
  }

  ionViewDidEnter(): void {
    this.enableBackNavigationBlock();
  }

  ionViewWillLeave(): void {
    this.disableBackNavigationBlock();
  }

  ngOnDestroy(): void {
    this.disableBackNavigationBlock();
    this.invitationUnsubscribe?.();
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

        this.foundBuddy = {
          email: this.primaryBuddy.email,
          firstName: this.primaryBuddy.fullName || this.deriveNameFromEmail(this.primaryBuddy.email),
          lastName: ''
        };

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

  private async listenForPrimaryInviteAcceptance(currentUserUid: string): Promise<void> {
  const currentUserProfile = await this.userService.getUserProfile(currentUserUid);
  if (!currentUserProfile?.email) return;

  // Clean up previous listener
  this.invitationUnsubscribe?.();

  this.invitationUnsubscribe = this.buddyService.listenForBuddyInvitations(
    currentUserUid
  );

  // Watch accepted buddy relations
  this.buddyService.buddyRelations$.subscribe(relations => {
    if (relations.length > 0) {
      this.primaryInviteStatus = 'accepted' as any;
    }
  });
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
    this.primaryInviteStatus = null;

    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) return;

    // Can't add yourself
    if (currentUser.email?.toLowerCase() === email) {
      await this.showToast('You cannot add yourself as your buddy.', 'warning');
      return;
    }

    // Check buddy limit before doing anything else
    const atLimit = await this.buddyService.hasReachedBuddyLimit(currentUser.uid);
    if (atLimit) {
      await this.showToast(
        `You've reached the maximum of ${this.buddyService.getMaxBuddyLimit()} buddies.`,
        'warning'
      );
      return;
    }

    // Check for duplicates
    const duplicate = await this.buddyService.checkDuplicateBuddyByEmail(currentUser.uid, email);
    if (duplicate.isDuplicate) {
      const msg =
        duplicate.type === 'pending_sent_invitation'
          ? `You already sent a request to ${duplicate.details?.name}.`
          : `${duplicate.details?.name} is already your buddy.`;
      await this.showToast(msg, 'warning');
      return;
    }

    // Actually search for the user in Firestore
    const matchedUser = await this.userService.getUserByEmail(email);

    if (matchedUser) {
      // User exists in AllerAid
      this.foundBuddy = {
        uid: matchedUser.uid,
        email: matchedUser.email,
        firstName: matchedUser.firstName,
        lastName: matchedUser.lastName
      };
      this.primaryBuddy = {
        fullName: `${matchedUser.firstName} ${matchedUser.lastName}`.trim(),
        relationship: this.primaryRelationship,
        contactNumber: matchedUser.phone || '',
        email: matchedUser.email
      };
      await this.showToast(`Found ${this.primaryBuddy.fullName}. Select relationship and continue.`, 'success');
    } else {
      // User not on AllerAid — show external invite section
      this.isExternalBuddy = true;
      this.externalInvite.email = email;
      await this.showToast('This email isn\'t on AllerAid yet. We\'ll send them an invite.', 'warning');
    }

  } catch (error) {
    console.error('Error searching buddy by email:', error);
    await this.showToast('Could not search for buddy. Try again.', 'danger');
  } finally {
    this.isSearchingBuddy = false;
  }
}

async sendPrimaryInvite(): Promise<void> {
  if (!this.foundBuddy) {
    await this.showToast('Please enter a buddy email first.', 'warning');
    return;
  }

  if (!this.primaryRelationship) {
    await this.showToast('Please select your relationship.', 'warning');
    return;
  }

  try {
    this.isSendingPrimaryInvite = true;

    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      await this.showToast('You must be logged in.', 'danger');
      return;
    }

    // Get the current user's full profile for the invitation
    const currentUserProfile = await this.userService.getUserProfile(currentUser.uid);
    if (!currentUserProfile) {
      await this.showToast('Could not load your profile.', 'danger');
      return;
    }

    if (this.foundBuddy.uid) {
      // Buddy is on AllerAid — send a proper invitation via BuddyService
      await this.buddyService.sendBuddyInvitationWithUser(
        currentUserProfile,
        this.foundBuddy,
        `${currentUserProfile.firstName} wants you as their emergency buddy on AllerAid.`
      );
    } else {
      // Buddy is NOT on AllerAid — store external invite
      await this.buddyService.sendBuddyInvitation(
        this.foundBuddy.email,
        this.foundBuddy.firstName,
        `${currentUserProfile.firstName} wants you as their emergency buddy on AllerAid.`
      );
    }

    // Update profile emergency contact with buddy info
    await this.userService.updateProfileDetails(currentUser.uid, {
      emergencyContactName: this.primaryBuddy.fullName,
      emergencyContactPhone: this.primaryBuddy.contactNumber || null
    });

    this.primaryInviteStatus = 'sent';
    await this.showToast('Buddy request sent successfully.', 'success');

  } catch (error: any) {
    console.error('Error sending primary buddy invite:', error);
    this.primaryInviteStatus = 'failed';

    // Surface meaningful errors to the user
    const msg = error?.message?.includes('maximum')
      ? error.message
      : 'Could not send buddy request. Please try again.';

    await this.showToast(msg, 'danger');
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

      await this.showToast('Invite saved.', 'success');
    } catch (error) {
      console.error('Error saving external invite:', error);
      await this.showToast('Could not save invite.', 'danger');
    }
  }

  async saveAndContinue(): Promise<void> {
    if (!this.foundBuddy && !this.isExternalBuddy) {
      await this.showToast('Please enter a buddy email first.', 'warning');
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
                  buddyUid: this.foundBuddy?.uid || '',
                  status: 'pending',
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
                  inviteStatus: this.secondaryInviteStatus || 'skipped'
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
        'Secondary buddy details must be complete before saving.',
        'warning'
      );
      return;
    }

    try {
      this.isSendingSecondaryInvite = true;

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in.', 'danger');
        return;
      }

      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          buddySetupOnboarding: {
            secondaryBuddy: {
              ...this.secondaryBuddy,
              status: 'pending',
              inviteStatus: 'sent',
              createdAt: new Date()
            },
            updatedAt: new Date()
          }
        },
        { merge: true }
      );

      this.secondaryInviteStatus = 'sent';
      await this.showToast('Secondary buddy request saved.', 'success');
    } catch (error) {
      console.error('Error saving secondary buddy request:', error);
      this.secondaryInviteStatus = 'failed';
      await this.showToast('Could not save secondary buddy request.', 'danger');
    } finally {
      this.isSendingSecondaryInvite = false;
    }
  }

  getInviteButtonLabel(status: InviteStatus | null): string {
    if (status === 'sent') return 'Saved';
    if (status === 'already_exists') return 'Already Connected';
    return 'Save Request';
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

  skipBuddySetup(): void {
  this.showFallback = true;
  // Scroll to fallback card after render
  setTimeout(() => {
    const el = document.querySelector('.fallback-card');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

toggleHotline(index: number): void {
  this.hotlines[index].enabled = !this.hotlines[index].enabled;
}

hasFallback(): boolean {
  const hasContact = !!(this.fallbackContact.name?.trim() && this.fallbackContact.phone?.trim());
  const hasHotline = this.hotlines.some(h => h.enabled) || !!this.fallbackContact.customHotline?.trim();
  return hasContact || hasHotline;
}
}