import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { UserProfile } from '../../../core/services/models/user-profile.model';
import { AllergyService } from '../../../core/services/allergy.service';
import { MedicalService } from '../../../core/services/medical.profile.service';
import { EHRService } from '../../../core/services/ehr.service';

import { EmergencySettingsService } from 'src/app/core';

import { ProfileDetailService } from 'src/app/core';

@Injectable({
  providedIn: 'root'
})
export class ProfileDataLoaderService {

  private userProfileSubject = new BehaviorSubject<UserProfile | null>(null);
  private userAllergiesSubject = new BehaviorSubject<any[]>([]);
  private emergencyProfileSubject = new BehaviorSubject<any | null>(null);
  private emergencyInstructionsSubject = new BehaviorSubject<any[]>([]);
  private profileDetailsSubject = new BehaviorSubject<any | null>(null);

  userProfile$: Observable<UserProfile | null> = this.userProfileSubject.asObservable();
  userAllergies$: Observable<any[]> = this.userAllergiesSubject.asObservable();
  emergencyProfile$: Observable<any | null> = this.emergencyProfileSubject.asObservable();
  emergencyInstructions$: Observable<any[]> = this.emergencyInstructionsSubject.asObservable();
  profileDetails$: Observable<any | null> = this.profileDetailsSubject.asObservable();

  constructor(
    
    private authService: AuthService,
    private userService: UserService,
    private allergyService: AllergyService,
    private medicalService: MedicalService,
    private ehrService: EHRService,
    private emergencySettingsService: EmergencySettingsService,
    private profileDetailService: ProfileDetailService
  ) {}

  get userProfileValue(): UserProfile | null { return this.userProfileSubject.value; }
  get userAllergiesValue(): any[] { return this.userAllergiesSubject.value; }
  get emergencyProfileValue(): any | null {  return this.emergencyProfileSubject.value; }
  get emergencyInstructionsValue(): any[] { return this.emergencyInstructionsSubject.value; }
  get profileDetailsValue(): any | null { return this.profileDetailsSubject.value;}

  setUserProfile(profile: UserProfile | null): void { this.userProfileSubject.next(profile); }
  setEmergencyProfile(profile: any | null): void {this.emergencyProfileSubject.next(profile);}
  setUserAllergies(allergies: any[]): void { this.userAllergiesSubject.next(allergies); }

  async loadAllData(): Promise<void> {
  const user = await this.authService.waitForAuthInit();

  if (!user) {
    this.userProfileSubject.next(null);
    this.profileDetailsSubject.next(null);
    this.userAllergiesSubject.next([]);
    this.emergencyProfileSubject.next(null);
    this.emergencyInstructionsSubject.next([]);
    return;
  }

  const [profile, medicalInfo, instructions, profileDetails] = await Promise.all([
    this.userService.getUserProfile(user.uid),
    this.medicalService.getUserMedicalProfile(user.uid),
    this.medicalService.getEmergencyInstructions(user.uid),
    this.profileDetailService.getUserProfileDetails(user.uid)
  ]);

  const checkedAllergies = (medicalInfo?.allergies || []).filter((a: any) => a.checked);

  this.userProfileSubject.next(profile);
  this.profileDetailsSubject.next(profileDetails ?? null);
  this.userAllergiesSubject.next(checkedAllergies);

  this.emergencyProfileSubject.next({
    name: profile?.fullName || '',
    allergies: checkedAllergies
      .map((a: any) => a.label || a.value || a.name)
      .join(', '),
    instructions: medicalInfo?.generalEmergencyInstruction || '',
    emergencyContactPhone: profileDetails?.phone || '',
    dateOfBirth: profileDetails?.dateOfBirth || '',
    gender: profileDetails?.gender || '',
    bloodType: profileDetails?.bloodType || '',
    profile_picture: profileDetails?.profile_picture || null
  });

  this.emergencyInstructionsSubject.next(instructions || []);
}

  async loadMedicalData(): Promise<{
    emergencySettings: any;
    doctorVisits: any[];
    medicalHistory: any[];
    ehrAccessList: any[];
  }> {
    try {
      const user = await this.authService.waitForAuthInit();
      if (!user) return { emergencySettings: null, doctorVisits: [], medicalHistory: [], ehrAccessList: [] };

      const [emergencySettings, doctorVisits, medicalHistory, ehrRecord] = await Promise.all([
        this.emergencySettingsService.getEmergencySettings(user.uid),
        this.ehrService.getDoctorVisits(),
        this.ehrService.getMedicalHistory(),
        this.ehrService.getEHRRecord()
      ]);

      return {
        emergencySettings: emergencySettings || {},
        doctorVisits,
        medicalHistory,
        ehrAccessList: ehrRecord?.accessibleBy || []
      };
    } catch (error) {
      console.error('Error loading medical data:', error);
      return { emergencySettings: null, doctorVisits: [], medicalHistory: [], ehrAccessList: [] };
    }
  }

async refreshAllergies(currentUid: string): Promise<any[]> {
  try {
    const userAllergyDocs = await this.allergyService.getUserAllergies(currentUid);

    const allergies = userAllergyDocs.filter((a: any) => a.checked);

    this.userAllergiesSubject.next(allergies);
    const currentProfile = this.emergencyProfileSubject.value;

    if (currentProfile) {
      this.emergencyProfileSubject.next({
        ...currentProfile,
        allergies: allergies
          .map(a => a.label || a.value || a.name)
          .join(', ')
      });
    }
    return allergies;
  } catch (error) {
    console.error('Error refreshing allergies:', error);
    return [];
  }
}
}