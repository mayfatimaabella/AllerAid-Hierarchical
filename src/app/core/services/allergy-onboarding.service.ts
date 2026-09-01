import { Injectable } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { FirebaseService } from './firebase.service';
import { MedicalInfo } from '../models/medical-info.model';

@Injectable({
  providedIn: 'root'
})
export class AllergyOnboardingService {
  private db;

  constructor(
    private firebaseService: FirebaseService
  ) {
    this.db = this.firebaseService.getDb();
  }

  /**
   * Get the user's medical/info document.
   */
  private async getMedicalInfo(
    uid: string
  ): Promise<MedicalInfo | null> {
    const medicalRef = doc(
      this.db,
      `users/${uid}/medical/info`
    );

    const userDoc = await getDoc(medicalRef);

    return userDoc.exists()
      ? (userDoc.data() as MedicalInfo)
      : null;
  }

  /**
   * Check whether the user has completed allergy onboarding.
   */
  async hasCompletedAllergyOnboarding(uid: string): Promise<boolean> {
    try {
      const medicalInfo = await this.getMedicalInfo(uid);

      return medicalInfo?.allergyOnboardingCompleted === true;
    } catch (error) {
      console.error(
        'Error checking allergy onboarding status:',
        error
      );

      return false;
    }
  }

  /**
   * Mark allergy onboarding as completed.
   */
  async markAllergyOnboardingCompleted(uid: string): Promise<void> {
    try {
      const medicalRef = doc(
        this.db,
        `users/${uid}/medical/info`
      );

      await setDoc(
        medicalRef,
        {
          allergyOnboardingCompleted: true,
          updatedAt: new Date()
        },
        { merge: true }
      );

      console.log(
        'Allergy onboarding marked as completed'
      );
    } catch (error) {
      console.error(
        'Error marking allergy onboarding as completed:',
        error
      );

      throw error;
    }
  }

  /**
   * Reset allergy onboarding status.
   *
   * Useful if the user needs to go through onboarding again.
   */
  async reset(uid: string): Promise<void> {
    try {
      const medicalRef = doc(
        this.db,
        `users/${uid}/medical/info`
      );

      await setDoc(
        medicalRef,
        {
          allergyOnboardingCompleted: false,
          updatedAt: new Date()
        },
        { merge: true }
      );

      console.log(
        'Allergy onboarding status reset'
      );
    } catch (error) {
      console.error(
        'Error resetting allergy onboarding status:',
        error
      );

      throw error;
    }
  }
}
