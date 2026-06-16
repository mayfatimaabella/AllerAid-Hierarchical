import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, ToastController } from '@ionic/angular';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';

import { AuthService } from '../../../../core/services/auth.service';
import { BuddyService } from '../../../../core/services/buddy.service';
import { UserService } from '../../../../core/services/user.service';
import { FirebaseService } from '../../../../core/services/firebase.service';
import { MedicalService } from '../../../../core/services/medical.profile.service';

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
  id?: string;
  name: string;
  number: string;
  enabled: boolean;
  isActive?: boolean;
}

type InviteStatus =
  | 'pending'
  | 'already_exists'
  | 'failed'
  | 'skipped'
  | 'accepted';

@Component({
  selector: 'app-buddy-setup-onboarding',
  templateUrl: './buddy-setup-onboarding.page.html',
  styleUrls: ['./buddy-setup-onboarding.page.scss'],
  standalone: false,
})
export class BuddySetupOnboardingPage implements OnInit, OnDestroy {
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
    customHotline: '',
  };

  hotlines: Hotline[] = [];

  externalInvite: ExternalBuddyInvite = {
    email: '',
    phone: '',
  };

  primaryBuddy: BuddySetupEntry = {
    fullName: '',
    relationship: '',
    contactNumber: '',
    email: '',
  };

  isLoading = true;
  isSaving = false;
  isSendingPrimaryInvite = false;

  primaryInviteStatus: InviteStatus | null = null;

  private backButtonSubscription?: Subscription;
  private db;

  constructor(
    private router: Router,
    private platform: Platform,
    private authService: AuthService,
    private userService: UserService,
    private buddyService: BuddyService,
    private firebaseService: FirebaseService,
    private toastController: ToastController,
    private medicalService: MedicalService
  ) {
    this.db = this.firebaseService.getDb();
  }

  async ngOnInit(): Promise<void> {
    await this.loadHotlines();
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

    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(
      9999,
      () => {}
    );

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
    await this.router.navigate(['/emergency-instructions-onboarding'], {
      replaceUrl: true,
    });
  }

  hasLockedPrimaryInvite(): boolean {
    return (
      this.primaryInviteStatus === 'pending' ||
      this.primaryInviteStatus === 'accepted'
    );
  }

  canEditPrimaryBuddy(): boolean {
    return !this.hasLockedPrimaryInvite();
  }

  getPrimaryActionLabel(): string {
    if (this.primaryInviteStatus === 'pending') {
      return 'Continue to Location';
    }

    if (this.primaryInviteStatus === 'accepted') {
      return 'Continue to Location';
    }

    return this.isExternalBuddy
      ? 'Save Invite & Continue'
      : 'Send Request & Continue';
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
          email: existing.primaryBuddy.email || '',
        };

        this.buddySearchEmail = this.primaryBuddy.email;
        this.primaryRelationship = this.primaryBuddy.relationship;

        this.foundBuddy = {
          uid: existing.primaryBuddy.buddyUid || '',
          email: this.primaryBuddy.email,
          firstName:
            existing.primaryBuddy.fullName ||
            this.deriveNameFromEmail(this.primaryBuddy.email),
          lastName: '',
        };

        if (existing.primaryBuddy.inviteStatus) {
          this.primaryInviteStatus =
            existing.primaryBuddy.inviteStatus as InviteStatus;
        } else if (existing.primaryBuddy.status) {
          this.primaryInviteStatus =
            existing.primaryBuddy.status as InviteStatus;
        }
      }

      if (existing.externalInvite) {
        this.externalInvite = {
          email: existing.externalInvite.email || '',
          phone: existing.externalInvite.phone || '',
        };

        this.isExternalBuddy = true;
      }

      if (existing.skippedBuddySetup) {
        this.showFallback = true;
      }
    } catch (error) {
      console.error('Error loading buddy setup onboarding:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async searchBuddyByEmail(): Promise<void> {
    if (this.hasLockedPrimaryInvite()) {
      await this.showToast(
        this.primaryInviteStatus === 'pending'
          ? 'You already have a pending buddy request.'
          : 'This buddy request has already been accepted.',
        'warning'
      );
      return;
    }

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

      if (!currentUser) {
        await this.showToast('You must be logged in.', 'danger');
        return;
      }

      if (currentUser.email?.toLowerCase() === email) {
        await this.showToast('You cannot add yourself as your buddy.', 'warning');
        return;
      }

      const atLimit = await this.buddyService.hasReachedBuddyLimit(currentUser.uid);

      if (atLimit) {
        await this.showToast(
          `You've reached the maximum of ${this.buddyService.getMaxBuddyLimit()} buddies.`,
          'warning'
        );
        return;
      }

      const duplicate = await this.buddyService.checkDuplicateBuddyByEmail(
        currentUser.uid,
        email
      );

      if (duplicate.isDuplicate) {
        if (duplicate.type === 'pending_sent_invitation') {
          this.primaryInviteStatus = 'pending';
        }

        if (duplicate.type === 'accepted_relation') {
          this.primaryInviteStatus = 'accepted';
        }

        const msg =
          duplicate.type === 'pending_sent_invitation'
            ? `You already sent a request to ${duplicate.details?.name || email}.`
            : `${duplicate.details?.name || email} is already your buddy.`;

        await this.showToast(msg, 'warning');
        return;
      }

      const matchedUser = await this.userService.getUserByEmail(email);

      if (matchedUser) {
        this.foundBuddy = {
          uid: matchedUser.uid,
          email: matchedUser.email,
          firstName: matchedUser.firstName,
          lastName: matchedUser.lastName,
        };

        this.primaryBuddy = {
          fullName: `${matchedUser.firstName || ''} ${matchedUser.lastName || ''}`.trim(),
          relationship: this.primaryRelationship,
          contactNumber: '',
          email: matchedUser.email,
        };

        await this.showToast(
          `Found ${this.primaryBuddy.fullName || matchedUser.email}. Select relationship and continue.`,
          'success'
        );
      } else {
        this.isExternalBuddy = true;

        this.externalInvite = {
          ...this.externalInvite,
          email,
        };

        await this.showToast(
          'This email is not on AllerAid yet. We will save an invite for them.',
          'warning'
        );
      }
    } catch (error) {
      console.error('Error searching buddy by email:', error);
      await this.showToast('Could not search for buddy. Try again.', 'danger');
    } finally {
      this.isSearchingBuddy = false;
    }
  }

  async sendPrimaryInvite(): Promise<boolean> {
    if (this.hasLockedPrimaryInvite()) {
      await this.showToast(
        this.primaryInviteStatus === 'pending'
          ? 'You already have a pending buddy request.'
          : 'This buddy request has already been accepted.',
        'warning'
      );
      return false;
    }

    if (!this.foundBuddy) {
      await this.showToast('Please enter a buddy email first.', 'warning');
      return false;
    }

    if (!this.primaryRelationship) {
      await this.showToast('Please select your relationship.', 'warning');
      return false;
    }

    try {
      this.isSendingPrimaryInvite = true;

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in.', 'danger');
        return false;
      }

      const duplicate = await this.buddyService.checkDuplicateBuddyByEmail(
        currentUser.uid,
        this.foundBuddy.email
      );

      if (duplicate.isDuplicate) {
        if (duplicate.type === 'pending_sent_invitation') {
          this.primaryInviteStatus = 'pending';
          await this.showToast('You already have a pending request for this buddy.', 'warning');
          return false;
        }

        if (duplicate.type === 'accepted_relation') {
          this.primaryInviteStatus = 'accepted';
          await this.showToast('This user is already your buddy.', 'warning');
          return false;
        }
      }

      const currentUserProfile = await this.userService.getUserProfile(currentUser.uid);

      if (!currentUserProfile) {
        await this.showToast('Could not load your profile.', 'danger');
        return false;
      }

      await this.buddyService.sendBuddyInvitationWithUser(
        currentUserProfile,
        this.foundBuddy,
        `${currentUserProfile.firstName} wants you as their emergency buddy on AllerAid.`,
        this.primaryRelationship
      );

      this.primaryInviteStatus = 'pending';

      await this.showToast('Buddy request sent successfully.', 'success');
      return true;
    } catch (error: any) {
      console.error('Error sending primary buddy invite:', error);

      this.primaryInviteStatus = 'failed';

      const msg = error?.message?.includes('maximum')
        ? error.message
        : 'Could not send buddy request. Please try again.';

      await this.showToast(msg, 'danger');
      return false;
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
              createdAt: new Date(),
            },
            updatedAt: new Date(),
          },
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
      await this.showToast('Please search for a buddy first.', 'warning');
      return;
    }

    if (this.foundBuddy && !this.primaryRelationship) {
      await this.showToast('Please select your relationship.', 'warning');
      return;
    }

    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in to continue.', 'danger');
        return;
      }

      /*
       * Important:
       * If status is pending or accepted, DO NOT send again.
       * Just keep the saved request and continue.
       */
      if (
        this.foundBuddy &&
        this.primaryInviteStatus !== 'pending' &&
        this.primaryInviteStatus !== 'accepted'
      ) {
        const inviteSent = await this.sendPrimaryInvite();

        if (!inviteSent) {
          return;
        }
      }

      if (this.isExternalBuddy) {
        const email = this.externalInvite.email.trim().toLowerCase();
        const phone = this.externalInvite.phone.trim();

        if (!this.isValidEmail(email) && !phone) {
          await this.showToast('Enter an email or phone number for the invite.', 'warning');
          return;
        }

        await this.sendExternalInviteLink();
      }

      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          buddySetupOnboarding: {
            primaryBuddy: this.foundBuddy
              ? {
                  ...this.primaryBuddy,
                  fullName:
                    this.primaryBuddy.fullName ||
                    `${this.foundBuddy.firstName || ''} ${this.foundBuddy.lastName || ''}`.trim(),
                  relationship: this.primaryRelationship,
                  buddyUid: this.foundBuddy?.uid || '',
                  email: this.foundBuddy?.email || this.primaryBuddy.email,
                  contactNumber: this.primaryBuddy.contactNumber || '',
                  status: this.primaryInviteStatus || 'pending',
                  inviteStatus: this.primaryInviteStatus || 'pending',
                }
              : null,

            externalInvite: this.isExternalBuddy
              ? {
                  email: this.externalInvite.email.trim().toLowerCase(),
                  phone: this.externalInvite.phone.trim(),
                  status: 'pending_signup',
                }
              : null,

            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      await this.medicalService.markAllergyOnboardingCompleted(currentUser.uid);

      if (this.primaryInviteStatus === 'pending') {
        await this.showToast(
          'Buddy request is already pending. Continuing setup.',
          'success'
        );
      } else if (this.primaryInviteStatus === 'accepted') {
        await this.showToast(
          'Buddy already connected. Continuing setup.',
          'success'
        );
      } else {
        await this.showToast('Buddy setup complete.', 'success');
      }

      await this.router.navigate(['/location-permission-onboarding'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Error saving buddy setup onboarding:', error);
      await this.showToast('Failed to save buddy setup. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  skipBuddySetup(): void {
    this.showFallback = true;

    setTimeout(() => {
      const el = document.querySelector('.fallback-card');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  toggleHotline(index: number): void {
    this.hotlines[index].enabled = !this.hotlines[index].enabled;
  }

  hasFallback(): boolean {
    const hasContact = !!(
      this.fallbackContact.name?.trim() &&
      this.fallbackContact.phone?.trim()
    );

    const hasHotline =
      this.hotlines.some(h => h.enabled) ||
      !!this.fallbackContact.customHotline?.trim();

    return hasContact || hasHotline;
  }

  async saveFallbackAndContinue(): Promise<void> {
    if (!this.hasFallback()) {
      await this.showToast(
        'Please add at least one trusted contact or hotline.',
        'warning'
      );
      return;
    }

    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in.', 'danger');
        return;
      }

      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          fallbackEmergencySetup: {
            trustedContact: {
              name: this.fallbackContact.name.trim(),
              phone: this.fallbackContact.phone.trim(),
            },
            enabledHotlines: this.hotlines.filter(h => h.enabled),
            customHotline: this.fallbackContact.customHotline.trim(),
            updatedAt: new Date(),
          },
          buddySetupOnboarding: {
            skippedBuddySetup: true,
            fallbackUsed: true,
            skippedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      await this.medicalService.markAllergyOnboardingCompleted(currentUser.uid);

      await this.showToast('Emergency setup saved.', 'success');

      await this.router.navigate(['/location-permission-onboarding'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Error saving fallback setup:', error);
      await this.showToast('Failed to save fallback setup.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async finishWithoutBuddy(): Promise<void> {
    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in.', 'danger');
        return;
      }

      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          buddySetupOnboarding: {
            skippedBuddySetup: true,
            fallbackUsed: false,
            skippedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      await this.medicalService.markAllergyOnboardingCompleted(currentUser.uid);

      await this.showToast(
        'Setup complete. Add a buddy anytime from your profile.',
        'success'
      );

      await this.router.navigate(['/location-permission-onboarding'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Error finishing without buddy:', error);
      await this.showToast('Something went wrong. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async loadHotlines(): Promise<void> {
    try {
      const hotlineQuery = query(
        collection(this.db, 'emergency_hotlines'),
        orderBy('order', 'asc')
      );

      const snapshot = await getDocs(hotlineQuery);

      this.hotlines = snapshot.docs
        .map(hotlineDoc => {
          const data = hotlineDoc.data();

          return {
            id: hotlineDoc.id,
            name: data['name'] || '',
            number: data['number'] || '',
            enabled: data['defaultEnabled'] === true,
            isActive: data['isActive'] === true,
          };
        })
        .filter(h => h.isActive);

      console.log('Loaded hotlines:', this.hotlines);
    } catch (error) {
      console.error('Error loading hotlines:', error);

      this.hotlines = [
        { name: 'Emergency (PH)', number: '911', enabled: true },
        { name: 'Red Cross PH', number: '143', enabled: true },
        { name: 'DOH Hotline', number: '1555', enabled: true },
      ];
    }
  }

  onFallbackPhoneInput(event: any): void {
    const rawValue = event?.detail?.value || '';

    const cleaned = rawValue.replace(/\D/g, '').slice(0, 11);

    this.fallbackContact.phone = cleaned;

    if (event.target) {
      event.target.value = cleaned;
    }
  }

  onNameInput(event: any): void {
    const rawValue = event?.detail?.value || '';

    const cleaned = rawValue.replace(/[^a-zA-Z\s.'-]/g, '');

    this.fallbackContact.name = cleaned;

    if (event.target) {
      event.target.value = cleaned;
    }
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
      position: 'bottom',
    });

    await toast.present();
  }
}