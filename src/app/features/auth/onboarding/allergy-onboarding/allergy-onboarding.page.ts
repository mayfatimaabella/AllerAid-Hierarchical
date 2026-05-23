import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AllergyService } from '../../../../core/services/allergy.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Platform, ToastController, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { doc, setDoc } from 'firebase/firestore';
import { FirebaseService } from '../../../../core/services/firebase.service';

@Component({
  selector: 'app-allergy-onboarding',
  templateUrl: './allergy-onboarding.page.html',
  styleUrls: ['./allergy-onboarding.page.scss'],
  standalone: false,
})
export class AllergyOnboardingPage implements OnInit, OnDestroy {
  allergyOptions: any[] = [];
  commonAllergens: any[] = [];
  otherAllergens: any[] = [];
  isLoading = true;
  isSaving = false;

  readonly MAX_CUSTOM_ALLERGENS = 3;

  private backButtonSubscription?: Subscription;
  private db;

  constructor(
    private router: Router,
    private allergyService: AllergyService,
    private authService: AuthService,
    private platform: Platform,
    private toastController: ToastController,
    private alertController: AlertController,
    private firebaseService: FirebaseService,
  ) {
    this.db = this.firebaseService.getDb();
  }

  ngOnInit() {
    this.loadAllergyOptions();
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
    });

    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', this.onPopState);
  }

  private disableBackNavigationBlock(): void {
    this.backButtonSubscription?.unsubscribe();
    this.backButtonSubscription = undefined;
    window.removeEventListener('popstate', this.onPopState);
  }

  async loadAllergyOptions() {
    try {
      this.isLoading = true;

      const options = await this.allergyService.getAllergyOptions();

      if (!options || options.length === 0) {
        this.allergyOptions = [];
        this.commonAllergens = [];
        this.otherAllergens = [];
        return;
      }

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.presentToast('Session expired. Please log in again.', 'danger');
        this.router.navigate(['/login'], { replaceUrl: true });
        return;
      }

      const userAllergies = await this.allergyService.getUserAllergies(currentUser.uid);

      if (userAllergies && userAllergies.length > 0) {
        const userAllergiesMap = new Map();

        userAllergies.forEach((allergy: any) => {
          userAllergiesMap.set(allergy.name, allergy);
        });

        this.allergyOptions = options.map((option: any) => {
          const userAllergy = userAllergiesMap.get(option.name);

          return {
            ...option,
            checked: userAllergy ? userAllergy.checked : false,
            value: userAllergy?.value || (option.hasInput ? '' : undefined),
            label: userAllergy?.customValue || option.label,
          };
        });
      } else {
        this.allergyOptions = options.map((option: any) => ({
          ...option,
          checked: false,
          value: option.hasInput ? '' : null,
        }));
      }

      this.groupAllergyOptions();
    } catch (error) {
      console.error('Error loading allergy options:', error);
      await this.presentToast('Failed to load allergy options.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  private groupAllergyOptions(): void {
    const commonNames = new Set([
      'peanuts',
      'shellfish',
      'dairy',
      'wheat',
      'fish',
      'eggs',
      'soy',
    ]);

    const reservedOtherNames = new Set(['other', 'others']);

    this.commonAllergens = this.allergyOptions.filter(o =>
      commonNames.has(o.name)
    );

    this.otherAllergens = this.allergyOptions.filter(o =>
      !commonNames.has(o.name) && !reservedOtherNames.has(o.name)
    );
  }

  get customAllergenCount(): number {
    return this.allergyOptions.filter(a => a.category === 'other' && a.hasInput).length;
  }

  get canAddMoreAllergens(): boolean {
    return this.customAllergenCount < this.MAX_CUSTOM_ALLERGENS;
  }

  /** True when at least one allergy chip is checked — controls skip visibility */
  get hasAnySelected(): boolean {
    return this.allergyOptions.some(a => a.checked);
  }

  addOtherOption() {
    if (!this.canAddMoreAllergens) {
      this.presentToast(
        `You can only add up to ${this.MAX_CUSTOM_ALLERGENS} custom allergens.`,
        'warning'
      );
      return;
    }

    const newOption = {
      name: `other_${Date.now()}`,
      label: 'Other',
      checked: true,
      hasInput: true,
      value: '',
      category: 'other',
    };

    this.allergyOptions.push(newOption);
    this.otherAllergens.push(newOption);
  }

  removeOtherOption(option: any) {
    this.allergyOptions = this.allergyOptions.filter(a => a !== option);
    this.otherAllergens = this.otherAllergens.filter(a => a !== option);
  }

  async presentToast(
    message: string,
    color: string = 'medium',
    duration: number = 3000
  ) {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'bottom',
    });

    await toast.present();
  }

  async submitAllergies() {
    this.isSaving = true;

    const hasSelectedAllergies = this.allergyOptions.some(allergy => allergy.checked);

    if (!hasSelectedAllergies) {
      await this.presentToast(
        'Please select at least one allergy or use "I have no known allergies".',
        'warning'
      );
      this.isSaving = false;
      return;
    }

    const missingInput = this.allergyOptions.find(allergy =>
      allergy.checked && allergy.hasInput && !allergy.value?.trim()
    );

    if (missingInput) {
      await this.presentToast(`Please specify your ${missingInput.label}.`, 'warning');
      this.isSaving = false;
      return;
    }

    try {
      await this.saveAllergies();

      const selectedAllergies = this.allergyOptions
        .filter(allergy => allergy.checked)
        .map(allergy => {
          const inputValue = allergy.value?.trim() ?? null;

          return {
            name: allergy.name,
            label: allergy.hasInput && inputValue ? inputValue : allergy.label,
            checked: true,
            ...(inputValue ? { value: inputValue } : {})
          };
        });

      this.router.navigate(['/emergency-instructions-onboarding'], {
        state: { allergies: selectedAllergies },
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Error during submission:', error);
      await this.presentToast('Failed to complete the process. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async saveAllergies() {
    try {
      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        throw new Error('No authenticated user found. Cannot save allergies.');
      }

      const checkedAllergies = this.allergyOptions.filter(allergy => allergy.checked);

      const customAllergies = checkedAllergies.filter(allergy =>
        allergy.value &&
        allergy.hasInput &&
        (allergy.category === 'other' || allergy.name === 'others')
      );

    for (const allergy of customAllergies) {
      const label = allergy.value.trim();

      await this.allergyService.submitAllergySuggestion({
        name: label
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '_'),
        label,
        category: 'other',
        suggestedBy: currentUser.uid,
        status: 'pending'
      });
    }

      const sanitizedAllergies = checkedAllergies.map(allergy => {
        const inputValue = allergy.value?.trim() ?? null;
        return {
          name: allergy.name,
          label: allergy.hasInput && inputValue ? inputValue : allergy.label,
          checked: true,
          ...(inputValue ? { value: inputValue } : {})
        };
      });

      await this.allergyService.saveUserAllergies(currentUser.uid, sanitizedAllergies);
      await this.presentToast('Allergies saved successfully!', 'success', 2000);
    } catch (error) {
      console.error('Error saving allergies:', error);
      await this.presentToast('Failed to save allergies.', 'danger');
      throw error;
    }
  }

  /**
   * Shown when no allergy chips are selected.
   * Confirms the user genuinely has no known allergies,
   * persists a skip flag, then moves forward.
   */
  async confirmNoAllergies(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'No known allergies?',
      message:
        'We\'ll mark this step as complete. You can always add allergies later from your profile.',
      backdropDismiss: false,
      buttons: [
        { text: 'Go back', role: 'cancel' },
        { text: 'Yes, continue', role: 'confirm' },
      ],
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        await this.presentToast('Session expired. Please log in again.', 'danger');
        return;
      }

      // Persist skip intent so the profile screen can surface a nudge later
      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          allergyOnboarding: {
            skipped: true,
            skippedAt: new Date(),
            reason: 'no_known_allergies',
          },
        },
        { merge: true }
      );

      await this.router.navigate(['/emergency-instructions-onboarding'], {
        replaceUrl: true,
      });
    } catch (error) {
      console.error('Error persisting no-allergy skip:', error);
      await this.presentToast('Something went wrong. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }
}
