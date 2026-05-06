import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { MedicalService } from '../../../../core/services/medical.service';
import { AllergyService } from '../../../../core/services/allergy.service';
import { Subscription } from 'rxjs';

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
  isLoading = true;
  isSaving = false;
  private backButtonSubscription?: Subscription;

  constructor(
    private router: Router,
    private platform: Platform,
    private authService: AuthService,
    private medicalService: MedicalService,
    private allergyService: AllergyService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

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

      // Try history.state first (normal forward navigation).
      // Fall back to Firestore so a page refresh doesn't strand the user.
      const routeStateAllergies = (history.state?.allergies || []) as SelectedAllergy[];
      const fromRoute = routeStateAllergies.filter(a => a?.checked);

      if (fromRoute.length > 0) {
        this.selectedAllergies = fromRoute;
      } else {
        // Firestore fallback — works after refresh or deep-link
        const storedAllergies = await this.allergyService.getUserAllergies(currentUser.uid);
        this.selectedAllergies = (storedAllergies || []).filter(a => a?.checked);
      }

      // Load any previously saved instructions
      const existingInstructions = await this.medicalService.getEmergencyInstructions(currentUser.uid);
      const byId: Record<string, string> = {};
      existingInstructions.forEach((item: any) => {
        if (item?.allergyId && item?.instruction) {
          byId[item.allergyId] = item.instruction;
        }
      });

      this.selectedAllergies.forEach(allergy => {
        this.instructionsByAllergy[allergy.name] = byId[allergy.name] || '';
      });
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

  async saveAndContinue(): Promise<void> {
    // Warn if any allergy has no instruction filled in
    const emptyInstructions = this.selectedAllergies.filter(
      a => !(this.instructionsByAllergy[a.name] || '').trim()
    );

    if (emptyInstructions.length > 0) {
      const confirmed = await this.confirmSkipInstructions(emptyInstructions);
      if (!confirmed) return;
    }

    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        await this.showToast('You must be logged in to continue.', 'warning');
        return;
      }

      const tasks = this.selectedAllergies
        .map(allergy => ({
          allergy,
          instruction: (this.instructionsByAllergy[allergy.name] || '').trim()
        }))
        .filter(item => item.instruction.length > 0)
        .map(item =>
          this.medicalService.setEmergencyInstructionForAllergy(
            currentUser.uid,
            item.allergy.name,
            item.allergy.label,
            item.instruction
          )
        );

      await Promise.all(tasks);

      await this.showToast('Emergency instructions saved.', 'success');
      await this.router.navigate(['/buddy-setup-onboarding'], { replaceUrl: true });
    } catch (error) {
      console.error('Error saving emergency instructions onboarding data:', error);
      await this.showToast('Failed to save emergency instructions. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Show a confirmation alert when the user tries to continue
   * without filling in instructions for one or more allergies.
   * Returns true if the user confirms they want to skip.
   */
  private async confirmSkipInstructions(missing: SelectedAllergy[]): Promise<boolean> {
    const names = missing.map(a => a.label).join(', ');
    return new Promise(async resolve => {
      const alert = await this.alertController.create({
        header: 'Missing instructions',
        message: `You haven't added emergency instructions for: ${names}. Your buddy won't know what to do during an emergency for these allergies. Continue anyway?`,
        buttons: [
          {
            text: 'Go back',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: 'Continue anyway',
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }

  async skipForNow(): Promise<void> {
    const confirmed = await this.confirmSkipInstructions(this.selectedAllergies);
    if (!confirmed) return;

    try {
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
}