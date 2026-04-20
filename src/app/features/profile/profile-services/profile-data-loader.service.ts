import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { UserService, UserProfile } from '../../../core/services/user.service';
import { AllergyService } from '../../../core/services/allergy.service';
import { MedicalService } from '../../../core/services/medical.service';
import { EHRService } from '../../../core/services/ehr.service';
import { AllergyManagerService } from '../../../core/services/allergy-manager.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileDataLoaderService {

  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  private userAllergiesSubject = new BehaviorSubject<any[]>([]);
  private emergencyMessageSubject = new BehaviorSubject<any | null>(null);

  // Public observables
  userProfile$: Observable<UserProfile | null> = this.userProfileSubject.asObservable();
  userAllergies$: Observable<any[]> = this.userAllergiesSubject.asObservable();
  emergencyMessage$: Observable<any | null> = this.emergencyMessageSubject.asObservable();

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private allergyService: AllergyService,
    private allergyManager: AllergyManagerService,
    private medicalService: MedicalService,
    private ehrService: EHRService
  ) {}

  // Current values getters
  get userProfileValue(): UserProfile | null { return this.userProfileSubject.value; }
  get userAllergiesValue(): any[] { return this.userAllergiesSubject.value; }
  get emergencyMessageValue(): any | null { return this.emergencyMessageSubject.value; }

  setUserProfile(profile: UserProfile | null): void { this.userProfileSubject.next(profile); }
  setEmergencyMessage(message: any): void { this.emergencyMessageSubject.next(message); }
  setUserAllergies(allergies: any[]): void { this.userAllergiesSubject.next(allergies); }

  /**
   * Orchestrated loader: loads user profile, allergies, and medical data,
   * and publishes into subjects with sensible defaults.
   */
  async loadAllData(): Promise<void> {
    const { userProfile, userAllergies } = await this.loadUserProfile();
    this.userProfileSubject.next(userProfile);
    this.userAllergiesSubject.next(userAllergies || []);

    const medical = await this.loadMedicalData();
    let emergencyMessage = medical.emergencyMessage;

    // Default emergency message if missing
    if (!emergencyMessage && userProfile) {
      emergencyMessage = {
        name: userProfile.fullName || '',
        allergies: (userAllergies || []).map((a: any) => a.label || a.name).join(', '),
        instructions: '',
        location: 'Map Location'
      };
    }
    this.emergencyMessageSubject.next(emergencyMessage || null);
  }

  /**
   * Load user profile and allergies
   */
  async loadUserProfile(): Promise<{
    userProfile: UserProfile | null;
    userAllergies: any[];
  }> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return { userProfile: null, userAllergies: [] };

      const userProfile = await this.userService.getUserProfile(currentUser.uid);
      if (!userProfile) return { userProfile: null, userAllergies: [] };

      const userAllergies = await this.allergyManager.loadUserAllergies();
      return { userProfile, userAllergies };
    } catch (error) {
      console.error('Error loading user profile:', error);
      return { userProfile: null, userAllergies: [] };
    }
  }

  /**
   * Load medical data (doctor visits, medical history, EHR)
   */
  async loadMedicalData(): Promise<{
    emergencyMessage: any;
    emergencySettings: any;
    doctorVisits: any[];
    medicalHistory: any[];
    ehrAccessList: any[];
  }> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        return {
          emergencyMessage: null,
          emergencySettings: null,
          doctorVisits: [],
          medicalHistory: [],
          ehrAccessList: []
        };
      }

      const medicalProfile = await this.medicalService.getUserMedicalProfile(currentUser.uid);
      const doctorVisits = await this.ehrService.getDoctorVisits();
      const medicalHistory = await this.ehrService.getMedicalHistory();
      const ehrRecord = await this.ehrService.getEHRRecord();

      return {
        emergencyMessage: medicalProfile?.emergencyMessage,
        emergencySettings: medicalProfile?.emergencySettings,
        doctorVisits,
        medicalHistory,
        ehrAccessList: ehrRecord?.accessibleBy || []
      };
    } catch (error) {
      console.error('Error loading medical data:', error);
      return {
        emergencyMessage: null,
        emergencySettings: null,
        doctorVisits: [],
        medicalHistory: [],
        ehrAccessList: []
      };
    }
  }

  /**
   * Refresh allergies from database
   */
  async refreshAllergies(currentUid: string): Promise<any[]> {
    try {
      const userAllergyDocs = await this.allergyService.getUserAllergies(currentUid);
      const allergies: any[] = [];
      
      userAllergyDocs.forEach((allergyDoc: any) => {
        if (allergyDoc.allergies && Array.isArray(allergyDoc.allergies)) {
          const checkedAllergies = allergyDoc.allergies.filter((allergy: any) => allergy.checked);
          allergies.push(...checkedAllergies);
        }
      });

      // Publish and update emergency message allergies text
      this.userAllergiesSubject.next(allergies);
      const currentMsg = this.emergencyMessageSubject.value;
      if (currentMsg) {
        this.emergencyMessageSubject.next({
          ...currentMsg,
          allergies: allergies.map(a => a.label || a.name).join(', ')
        });
      }
      return allergies;
    } catch (error) {
      console.error('Error refreshing allergies:', error);
      return [];
    }
  }
}
