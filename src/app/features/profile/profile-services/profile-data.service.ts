import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserService, UserProfile } from '../../../core/services/user.service';
import { AllergyService } from '../../../core/services/allergy.service';
import { BuddyService } from '../../../core/services/buddy.service';
import { MedicationService, Medication } from '../../../core/services/medication.service';
import { EHRService, DoctorVisit, MedicalHistory } from '../../../core/services/ehr.service';
import { AuthService } from '../../../core/services/auth.service';

export interface ProfileData {
  userProfile: UserProfile | null;
  allergies: any[];
  buddies: any[];
  medications: Medication[];
  doctorVisits: DoctorVisit[];
  medicalHistory: MedicalHistory[];
  ehrAccessList: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ProfileDataService {
  private profileDataSubject = new BehaviorSubject<ProfileData>({
    userProfile: null,
    allergies: [],
    buddies: [],
    medications: [],
    doctorVisits: [],
    medicalHistory: [],
    ehrAccessList: []
  });

  public profileData$ = this.profileDataSubject.asObservable();

  constructor(
    private userService: UserService,
    private allergyService: AllergyService,
    private buddyService: BuddyService,
    private medicationService: MedicationService,
    private ehrService: EHRService,
    private authService: AuthService
  ) {}

  async loadAllProfileData(): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) return;

    try {
      const [
        userProfile,
        allergies,
        buddies,
        medications,
        doctorVisits,
        medicalHistory,
        ehrRecord
      ] = await Promise.all([
        this.userService.getUserProfile(currentUser.uid),
        this.loadUserAllergies(currentUser.uid),
        this.buddyService.getUserBuddies(currentUser.uid),
        this.medicationService.getUserMedications(currentUser.uid),
        this.ehrService.getDoctorVisits(),
        this.ehrService.getMedicalHistory(),
        this.ehrService.getEHRRecord()
      ]);

      const profileData: ProfileData = {
        userProfile,
        allergies,
        buddies,
        medications,
        doctorVisits,
        medicalHistory,
        ehrAccessList: ehrRecord?.accessibleBy || []
      };

      this.profileDataSubject.next(profileData);
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  }

  private async loadUserAllergies(uid: string): Promise<any[]> {
    const userAllergyDocs = await this.allergyService.getUserAllergies(uid);
    const allergies: any[] = [];
    
    userAllergyDocs.forEach((allergyDoc: any) => {
      if (allergyDoc.allergies && Array.isArray(allergyDoc.allergies)) {
        const checkedAllergies = allergyDoc.allergies.filter((allergy: any) => allergy.checked);
        allergies.push(...checkedAllergies);
      }
    });
    
    return allergies;
  }

  async refreshMedications(): Promise<void> {
    const currentData = this.profileDataSubject.value;
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) return;

    try {
      const medications = await this.medicationService.getUserMedications(currentUser.uid);
      this.profileDataSubject.next({
        ...currentData,
        medications
      });
    } catch (error) {
      console.error('Error refreshing medications:', error);
    }
  }

  async refreshEHRData(): Promise<void> {
    const currentData = this.profileDataSubject.value;
    
    try {
      const [doctorVisits, medicalHistory, ehrRecord] = await Promise.all([
        this.ehrService.getDoctorVisits(),
        this.ehrService.getMedicalHistory(),
        this.ehrService.getEHRRecord()
      ]);

      this.profileDataSubject.next({
        ...currentData,
        doctorVisits,
        medicalHistory,
        ehrAccessList: ehrRecord?.accessibleBy || []
      });
    } catch (error) {
      console.error('Error refreshing EHR data:', error);
    }
  }

  // Computed observables
  get allergiesCount$(): Observable<number> {
    return this.profileData$.pipe(
      map(data => data.allergies.length)
    );
  }

  get medicationsCount$(): Observable<number> {
    return this.profileData$.pipe(
      map(data => data.medications.length)
    );
  }

  get buddiesCount$(): Observable<number> {
    return this.profileData$.pipe(
      map(data => data.buddies.length)
    );
  }

  get activeMedicationsCount$(): Observable<number> {
    return this.profileData$.pipe(
      map(data => data.medications.filter(med => med.isActive).length)
    );
  }
}







