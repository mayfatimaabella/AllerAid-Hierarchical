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
      // Forward-only navigation lock
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
      let options = await this.allergyService.getAllergyOptions();
      
      if (!options || options.length === 0) {
        this.allergyOptions = [];
        this.commonAllergens = [];
        this.otherAllergens = [];
        return;
      }
      
      const currentUser = await this.authService.waitForAuthInit();
      const userId = currentUser ? currentUser.uid : 'test-user-123';
      const userAllergies = await this.allergyService.getUserAllergies(userId);
      
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
    } finally {
      this.isLoading = false;
    }
  }

  private groupAllergyOptions(): void {
    const commonNames = new Set(['peanuts', 'shellfish', 'dairy', 'wheat', 'fish', 'eggs', 'soy']);
    this.commonAllergens = this.allergyOptions.filter(option => commonNames.has(option.name));
    this.otherAllergens = this.allergyOptions.filter(option => !commonNames.has(option.name));
  }

  /**
   * Dynamically adds a new "Other" option for allergens not in the list.
   */
  addOtherOption() {
    const newOption = {
      name: 'others', // Matches the save logic filter for custom entries
      label: 'Other',
      checked: true,
      hasInput: true,
      value: '',
      category: 'other'
    };

    this.allergyOptions.push(newOption);
    this.otherAllergens.push(newOption);
  }

  async presentToast(message: string, color: string = 'medium', duration: number = 3000) {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'top'
    });
    await toast.present();
  }

  async submitAllergies() {
    this.isSaving = true;

    if (!this.allergyOptions.some(allergy => allergy.checked)) {
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
          return {
            name: allergy.name,
            label: (allergy.hasInput && inputValue) ? inputValue : allergy.label,
            checked: true,
            value: inputValue
          };
        });

      this.router.navigate(['/emergency-instructions-onboarding'], {
        state: { allergies: selectedAllergies },
        replaceUrl: true
      });
    } catch (error) {
      await this.presentToast('Failed to complete the process. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async saveAllergies() {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      const userId = currentUser ? currentUser.uid : 'test-user-123';

      const sanitizedAllergies = this.allergyOptions
        .filter(allergy => allergy.checked)
        .map(allergy => {
          const inputValue = allergy.value?.trim();
          return {
            name: allergy.name,
            label: (allergy.hasInput && inputValue) ? inputValue : allergy.label,
            checked: true,
            value: inputValue
          };
        });

      // Sync custom 'Other' entries to the master allergy list
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

      await this.allergyService.saveUserAllergies(userId, sanitizedAllergies);
      await this.presentToast('Allergies saved successfully!', 'success', 2000);
    } catch (error) {
      console.error('Error saving allergies:', error);
      await this.presentToast('Failed to save allergies.', 'danger');
      throw error;
    }
  }
}