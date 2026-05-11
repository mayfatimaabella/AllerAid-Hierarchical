import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { MedicalService } from '../../../../core/services/medical.profile.service';
import { AllergyService } from '../../../../core/services/allergy.service';
import { FirebaseService } from '../../../../core/services/firebase.service';
import { Subscription } from 'rxjs';
import { doc, setDoc } from 'firebase/firestore';

interface SelectedAllergy {
  name: string;
  label: string;
  checked: boolean;
  value?: string;
}

@Component({
  selector: 'app-emergency-instructions-onboarding',
  templateUrl: './emergency-instructions-onboarding.page.html',
  styleUrls: ['./emergency-instructions-onboarding.page.scss'],
  standalone: false,
})
export class EmergencyInstructionsOnboardingPage implements OnInit, OnDestroy {
  selectedAllergies: SelectedAllergy[] = [];
  instructionsByAllergy: Record<string, string> = {};
  generalInstruction: string = '';
  isLoading = true;
  isSaving = false;
  showTips = false;

  /** Controls the inline warning banner after the user first taps "Set up later" */
  showSkipNudge = false;

  /** Tracks whether the user has already seen the nudge and still wants to skip */
  private skipNudgeAcknowledged = false;

  private backButtonSubscription?: Subscription;
  private db;

  readonly tips = [
    {
      icon: 'medkit-outline',
      title: 'Mention your medication',
      example: 'Use my EpiPen in my bag, then call 911.'
    },
    {
      icon: 'call-outline',
      title: 'Include emergency contacts',
      example: 'Call my mom at 09XX-XXX-XXXX after calling 911.'
    },
    {
      icon: 'warning-outline',
      title: 'List what to avoid',
      example: 'Do NOT give me antihistamines — I need epinephrine only.'
    },
    {
      icon: 'navigate-outline',
      title: 'Nearest hospital',
      example: 'Bring me to Cebu Doctors Hospital, not a clinic.'
    },
    {
      icon: 'time-outline',
      title: 'Note time sensitivity',
      example: 'Symptoms escalate fast — act within 5 minutes.'
    }
  ];

  constructor(
    private router: Router,
    private platform: Platform,
    private authService: AuthService,
    private medicalService: MedicalService,
    private allergyService: AllergyService,
    private firebaseService: FirebaseService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    this.db = this.firebaseService.getDb();
  }

  async ngOnInit(): Promise<void> {
    await this.loadSelectedAllergies();
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
      // Intentionally noop: lock onboarding to forward-only navigation
    });
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', this.onPopState);
  }

  private disableBackNavigationBlock(): void {
    this.backButtonSubscription?.unsubscribe();
    this.backButtonSubscription = undefined;
    window.removeEventListener('popstate', this.onPopState);
  }

  private async loadSelectedAllergies(): Promise<void> {
    try {
      this.isLoading = true;

      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        this.selectedAllergies = [];
        return;
      }

      const routeStateAllergies = (history.state?.allergies || []) as SelectedAllergy[];
      const fromRoute = routeStateAllergies.filter(a => a?.checked);

      if (fromRoute.length > 0) {
        this.selectedAllergies = fromRoute;
      } else {
        const storedAllergies = await this.allergyService.getUserAllergies(currentUser.uid);
        this.selectedAllergies = (storedAllergies || []).filter(a => a?.checked);
      }

      const existingInstructions = await this.medicalService.getEmergencyInstructions(currentUser.uid);
      const byId: Record<string, string> = {};
      existingInstructions.forEach((item: any) => {
        if (item?.allergyId && item?.instruction) {
          byId[item.allergyId] = item.instruction;
        }
      });

      this.selectedAllergies.forEach(allergy => {
        this.instructionsByAllergy[this.getAllergyKey(allergy)] =
          byId[this.getAllergyKey(allergy)] || '';
      });

      const medicalData = await this.medicalService.getUserMedicalProfile(currentUser.uid);
      this.generalInstruction =
        medicalData?.emergencySettings?.generalInstruction ||
        medicalData?.generalInstruction ||
        '';

    } catch (error) {
      console.error('Error loading emergency instructions onboarding data:', error);
      this.selectedAllergies = [];
    } finally {
      this.isLoading = false;
    }
  }

  async goBackToAllergySetup(): Promise<void> {
    this.disableBackNavigationBlock();
    await this.router.navigate(['/allergy-onboarding'], { replaceUrl: true });
  }

  toggleTips(): void {
    this.showTips = !this.showTips;
  }

  dismissSkipNudge(): void {
    this.showSkipNudge = false;
    this.skipNudgeAcknowledged = true;
  }

  /**
   * First tap: show inline nudge banner so the user understands the consequence.
   * Second tap (after dismissing the nudge): skip with flag persisted.
   */
  async requestSkip(): Promise<void> {
    const hasAnyInstruction =
      !!this.generalInstruction.trim() ||
      this.selectedAllergies.some(
        a => !!(this.instructionsByAllergy[this.getAllergyKey(a)] || '').trim()
      );

    // If they already filled something, skip the nudge entirely
    if (hasAnyInstruction || this.skipNudgeAcknowledged) {
      await this.skipForNow();
      return;
    }

    // First time: show the inline nudge instead of navigating
    this.showSkipNudge = true;

    // Scroll to nudge so it's visible on small screens
    setTimeout(() => {
      const el = document.querySelector('.skip-nudge-banner');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  async saveAndContinue(): Promise<void> {
    const hasEmptyGeneral = !this.generalInstruction.trim();
    const emptyPerAllergy = this.selectedAllergies.filter(
      allergy => !(this.instructionsByAllergy[this.getAllergyKey(allergy)] || '').trim()
    );

    const hasAnythingMissing = hasEmptyGeneral || emptyPerAllergy.length > 0;

    if (hasAnythingMissing) {
      const confirmed = await this.confirmSkipInstructions(emptyPerAllergy, hasEmptyGeneral);
      if (!confirmed) return;
    }

    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        await this.showToast('You must be logged in to continue.', 'warning');
        return;
      }

      const emergencyInstructions = this.selectedAllergies
        .map(allergy => {
          const allergyId = this.getAllergyKey(allergy);
          const instruction = (this.instructionsByAllergy[allergyId] || '').trim();
          return { allergyId, allergyName: allergy.value || allergy.label, instruction };
        })
        .filter(item => item.instruction.length > 0);

      await this.medicalService.saveEmergencySettings(currentUser.uid, {
        emergencyInstructions,
        generalInstruction: this.generalInstruction.trim()
      });

      await this.showToast('Emergency instructions saved.', 'success');
      await this.router.navigate(['/buddy-setup-onboarding'], { replaceUrl: true });
    } catch (error) {
      console.error('Error saving emergency instructions onboarding data:', error);
      await this.showToast('Failed to save emergency instructions. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  private async confirmSkipInstructions(
    missingPerAllergy: SelectedAllergy[],
    missingGeneral: boolean
  ): Promise<boolean> {
    const parts: string[] = [];

    if (missingGeneral) {
      parts.push('a general emergency instruction');
    }

    if (missingPerAllergy.length > 0) {
      parts.push(`instructions for: ${missingPerAllergy.map(a => a.label).join(', ')}`);
    }

    const message = `You haven't added ${parts.join(' and ')}. Your buddy won't know what to do during an emergency. Continue anyway?`;

    const alert = await this.alertController.create({
      header: 'Missing instructions',
      message,
      backdropDismiss: false,
      buttons: [
        { text: 'Go back', role: 'cancel' },
        { text: 'Continue anyway', role: 'confirm' }
      ]
    });

    await alert.present();
    const result = await alert.onDidDismiss();
    return result.role === 'confirm';
  }

  /**
   * Persists the skip intent to Firestore so the profile screen
   * can surface a nudge like "You haven't set up emergency instructions yet."
   */
  async skipForNow(): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();

      if (currentUser) {
        await setDoc(
          doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
          {
            emergencyInstructionsOnboarding: {
              skipped: true,
              skippedAt: new Date(),
            },
          },
          { merge: true }
        );
      }

      await this.router.navigate(['/buddy-setup-onboarding'], { replaceUrl: true });
    } catch (error) {
      console.error('Error while skipping emergency instructions onboarding:', error);
      await this.showToast('Unable to continue. Please try again.', 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  getAllergyKey(allergy: SelectedAllergy): string {
    return `${allergy.name}-${allergy.value || allergy.label}`;
  }
}
