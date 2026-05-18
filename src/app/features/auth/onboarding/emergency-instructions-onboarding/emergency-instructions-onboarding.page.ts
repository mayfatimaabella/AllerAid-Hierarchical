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

  showSkipNudge = false;
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
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(9999, () => {});
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

      // Load existing per-allergy instructions from canonical root path
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

      // Load general instruction from canonical root path
      const medicalData = await this.medicalService.getUserMedicalProfile(currentUser.uid);
      this.generalInstruction = medicalData?.generalInstruction || '';

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

  async requestSkip(): Promise<void> {
    const hasAnyInstruction =
      !!this.generalInstruction.trim() ||
      this.selectedAllergies.some(
        a => !!(this.instructionsByAllergy[this.getAllergyKey(a)] || '').trim()
      );

    if (hasAnyInstruction || this.skipNudgeAcknowledged) {
      await this.skipForNow();
      return;
    }

    this.showSkipNudge = true;
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

    if (hasEmptyGeneral || emptyPerAllergy.length > 0) {
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

      const uid = currentUser.uid;

      // 1. Save general instruction to medical/info.emergencyInstruction (root field)
      await this.medicalService.setEmergencyInstruction(uid, this.generalInstruction.trim());

      // 2. Save each per-allergy instruction to medical/info.emergencyInstructions[] (root array)
      //    Build and write the full array in one pass for efficiency.
      const instructions = this.selectedAllergies
        .map(allergy => ({
          allergyId: this.getAllergyKey(allergy),
          allergyName: allergy.value || allergy.label,
          instruction: (this.instructionsByAllergy[this.getAllergyKey(allergy)] || '').trim()
        }))
        .filter(item => item.instruction.length > 0);

      // Upsert each entry via the service so dedup logic is centralised
      for (const item of instructions) {
        await this.medicalService.setEmergencyInstructionForAllergy(
          uid,
          item.allergyId,
          item.allergyName,
          item.instruction
        );
      }

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
    if (missingGeneral) parts.push('a general emergency instruction');
    if (missingPerAllergy.length > 0) {
      parts.push(`instructions for: ${missingPerAllergy.map(a => a.label).join(', ')}`);
    }

    const alert = await this.alertController.create({
      header: 'Missing instructions',
      message: `You haven't added ${parts.join(' and ')}. Your buddy won't know what to do during an emergency. Continue anyway?`,
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