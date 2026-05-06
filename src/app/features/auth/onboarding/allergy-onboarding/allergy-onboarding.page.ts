import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AllergyService } from '../../../../core/services/allergy.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Platform, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

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
  private backButtonSubscription?: Subscription;

  constructor(
    private router: Router,
    private allergyService: AllergyService,
    private userService: UserService,
    private authService: AuthService,
    private platform: Platform,
    private toastController: ToastController
  ) { }

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

  async loadAllergyOptions() {
    try {
      this.isLoading = true;

      // Load allergy options from Firebase
      let options = await this.allergyService.getAllergyOptions();

      console.log('Loaded options from Firebase:', options);

      // If no options exist in Firebase, show empty state
      if (!options || options.length === 0) {
        console.log('No options in Firebase, showing empty state');
        this.allergyOptions = [];
        this.commonAllergens = [];
        this.otherAllergens = [];
        return;
      }

      // Wait for auth to be initialized — no fallback to fake UIDs
      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        console.error('No authenticated user found during allergy onboarding load');
        await this.presentToast('Session expired. Please log in again.', 'danger');
        this.router.navigate(['/login'], { replaceUrl: true });
        return;
      }

      console.log('Loading allergy onboarding for user:', currentUser.email);

      // Get user's existing allergy data (if any)
      const userAllergies = await this.allergyService.getUserAllergies(currentUser.uid);
      console.log('Loaded user allergies:', userAllergies);

      if (userAllergies && userAllergies.length > 0) {
        const userAllergiesMap = new Map();
        userAllergies.forEach((allergy: any) => {
          userAllergiesMap.set(allergy.name, allergy);
        });

        this.allergyOptions = options.map(option => {
          const userAllergy = userAllergiesMap.get(option.name);
          return {
            ...option,
            checked: userAllergy ? userAllergy.checked : false,
            value: userAllergy?.value || (option.hasInput ? '' : undefined),
            label: userAllergy?.customValue || option.label
          };
        });

        console.log('Merged allergies with user data:', this.allergyOptions);
      } else {
        this.allergyOptions = options.map(option => ({
          ...option,
          checked: false,
          value: option.hasInput ? '' : undefined
        }));
      }

      this.groupAllergyOptions();

    } catch (error) {
      console.error('Error loading allergy options:', error);
      this.allergyOptions = [];
      this.commonAllergens = [];
      this.otherAllergens = [];
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
      'soy'
    ]);

    this.commonAllergens = this.allergyOptions.filter(option => commonNames.has(option.name));
    this.otherAllergens = this.allergyOptions.filter(option => !commonNames.has(option.name));
  }

  hasSelectedAllergies(): boolean {
    return this.allergyOptions.some(allergy => allergy.checked);
  }

  async goBackToLogin(): Promise<void> {
    this.disableBackNavigationBlock();
    await this.router.navigate(['/login']);
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
      position: 'bottom'
    });

    await toast.present();
  }

  async submitAllergies() {
    this.isSaving = true;

    const hasSelectedAllergies = this.allergyOptions.some(allergy => allergy.checked);

    if (!hasSelectedAllergies) {
      await this.presentToast('Please select at least one allergy or add "No Allergies".', 'warning');
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
          const inputValue = allergy.value?.trim();

          if (allergy.hasInput && inputValue) {
            return {
              name: allergy.name,
              label: inputValue,
              checked: true,
              value: inputValue
            };
          }
          return {
            name: allergy.name,
            label: allergy.label,
            checked: true,
            value: allergy.value
          };
        });

      this.router.navigate(['/emergency-instructions-onboarding'], {
        state: { allergies: selectedAllergies },
        replaceUrl: true
      });

    } catch (error) {
      console.error('Error during submission:', error);
      await this.presentToast('Failed to complete the process. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async saveAllergies() {
    // Wait for auth — no fake UID fallback
    const currentUser = await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('No authenticated user found. Cannot save allergies.');
    }

    console.log('Saving allergies for user:', currentUser.email);

    const sanitizedAllergies = this.allergyOptions
      .filter(allergy => allergy.checked)
      .map(allergy => {
        const inputValue = allergy.value?.trim();

        if (allergy.hasInput && inputValue) {
          return {
            name: allergy.name,
            label: inputValue,
            checked: true,
            value: inputValue
          };
        }

        return {
          name: allergy.name,
          label: allergy.label,
          checked: true
        };
      });

    const customAllergies = sanitizedAllergies.filter(allergy =>
      allergy.value && ['others', 'other'].includes(allergy.name.toLowerCase())
    );

    for (const allergy of customAllergies) {
      await this.allergyService.addAllergyOptionIfMissing({
        name: allergy.value.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_'),
        label: allergy.value,
        hasInput: false,
        category: 'other'
      });
    }

    await this.allergyService.saveUserAllergies(currentUser.uid, sanitizedAllergies);

    console.log('Saved user allergies');

    await this.presentToast('Allergies saved successfully!', 'success', 2000);
  }
}