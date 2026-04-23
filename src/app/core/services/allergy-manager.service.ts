import { Injectable } from '@angular/core';
import { AllergyService } from './allergy.service';
import { AuthService } from './auth.service';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AllergyManagerService {
  constructor(
    private allergyService: AllergyService,
    private authService: AuthService
  ) {}

  async loadUserAllergies(): Promise<any[]> {
    const user = await this.authService.waitForAuthInit();
    if (!user) return [];
    const docs = await this.allergyService.getUserAllergies(user.uid);

  return [].concat(...docs.map((doc: any) => doc.allergies?.filter((a: any) => a.checked) || []));
  }

  /**
   * Save allergies for the current user (add or update)
   */
  async saveUserAllergies(allergyOptions: any[]): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('No authenticated user');
    if (!environment.production) {
      console.log('Saving allergies for user:', currentUser.uid);
      console.log('Current allergy options:', allergyOptions);
    }
    const sanitizedAllergies = this.sanitizeAllergiesForSave(allergyOptions);
    await this.allergyService.saveUserAllergies(currentUser.uid, sanitizedAllergies);
    if (!environment.production) {
      console.log('Saved user allergies');
    }
  }

  /**
   * Refresh allergies display for the current user
   */
  async refreshUserAllergies(): Promise<any[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      if (!environment.production) {
        console.log('No authenticated user found for allergy refresh');
      }
      return [];
    }
    if (!environment.production) {
      console.log('Refreshing allergies display for user:', currentUser.uid);
    }
    const userAllergyDocs = await this.allergyService.getUserAllergies(currentUser.uid);
    if (!environment.production) {
      console.log('Refreshed allergy docs:', userAllergyDocs);
    }

    const checkedAllergies: any[] = [];
    userAllergyDocs.forEach((doc: any) => {
      if (doc.allergies && Array.isArray(doc.allergies)) {
        checkedAllergies.push(...doc.allergies.filter((a: any) => a.checked));
      }
    });
    return checkedAllergies;
  }

  /**
   * Update allergy options based on user's saved allergies
   */
  updateAllergyOptions(allergyOptions: any[], userAllergies: any[]): any[] {
    if (!environment.production) {
      console.log('Updating allergy options with user allergies:', userAllergies);
    }
    // Reset all options first
    allergyOptions.forEach(option => {
      option.checked = false;
      if (option.hasInput) {
        option.value = '';
      }
    });
    // Update options based on user's saved allergies
    allergyOptions.forEach(option => {
      const userAllergy = userAllergies.find(allergy =>
        allergy.name === option.name && allergy.checked === true
      );
      if (userAllergy) {
        if (!environment.production) {
          console.log(`Setting ${option.name} to checked with value:`, userAllergy.value);
        }
        option.checked = true;
        if (option.hasInput && userAllergy.value) {
          option.value = userAllergy.value;
        }
      }
    });
    if (!environment.production) {
      console.log('Updated allergy options:', allergyOptions);
    }
    return allergyOptions;
  }

  /**
   * Sanitize allergy data for saving
   */
  sanitizeAllergiesForSave(allergyOptions: any[]): any[] {
    return allergyOptions.map(allergy => {
      const cleanAllergy: Record<string, any> = {
        id: allergy.name,
        name: allergy.name,
        label: allergy.label,
        checked: allergy.checked,
        hasInput: allergy.hasInput || false
      };
      if (allergy.hasInput && allergy.value) {
        cleanAllergy['value'] = allergy.value;
      }
      return cleanAllergy;
    });
  }

  // Add more allergy-related logic here as needed
  /**
   * Load allergy options from Firebase, remove duplicates, sort, and map to expected structure
   */
  async loadAllergyOptions(): Promise<any[]> {
    try {
      const options = await this.allergyService.getAllergyOptions();
      if (options && options.length > 0) {
        // Remove duplicates by name and sort by order
        const uniqueOptions = options.reduce((acc: any[], option: any) => {
          const exists = acc.find(item => item.name === option.name);
          if (!exists) {
            acc.push(option);
          }
          return acc;
        }, []);
        const mappedOptions = uniqueOptions
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(option => ({
            name: option.name,
            label: option.label,
            checked: false,
            hasInput: option.hasInput || false,
            value: ''
          }));
        if (!environment.production) {
          console.log('Loaded allergy options:', mappedOptions);
        }
        return mappedOptions;
      } else {
        if (!environment.production) {
          console.log('No allergy options configured by admin');
        }
        return [];
      }
    } catch (error) {
      console.error('Error loading allergy options:', error);
      return [];
    }
  }
}
