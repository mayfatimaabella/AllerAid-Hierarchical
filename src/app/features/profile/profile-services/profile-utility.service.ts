import { Injectable } from '@angular/core';
import { AllergyManagerService } from '../../../core/services/allergy-manager.service';

interface AllergyLike {
  name: string;
  label?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileUtilityService {

  constructor(private allergyManager: AllergyManagerService) {}

  /**
   * Format date for display
   */
  formatDate(date: string | Date): string {
    if (!date) return 'Not specified';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  /**
   * Load and display user allergies
   */
  async loadAndDisplayUserAllergies(): Promise<any[]> {
    try {
      return await this.allergyManager.loadUserAllergies();
    } catch (error) {
      console.error('Error loading allergies:', error);
      return [];
    }
  }

  generateEmergencyAllergyText(allergies: AllergyLike[]): string {
    return allergies.map(allergy => allergy.label || allergy.name).join(', ');
  }
}

