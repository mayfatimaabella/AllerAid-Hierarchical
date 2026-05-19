import { Injectable } from '@angular/core';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { MedicalInfo } from './models/medical-info.model';
import { EmergencyInstruction } from './models/emergency-instruction.model';
import { EmergencyMessage } from './models/emergency-message.model';

@Injectable({
  providedIn: 'root'
})
export class MedicalService {
  private db;

  constructor(
    private firebaseService: FirebaseService,
  ) {
    this.db = this.firebaseService.getDb();
  }

  /**
   * Set the general emergency instruction string for a user.
   * Writes to medical/info.emergencyInstruction (root field).
   */
  async setEmergencyInstruction(uid: string, instruction: string): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      await setDoc(
        medicalRef,
        {
          generalEmergencyInstruction: instruction,
          updatedAt: new Date()
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error saving emergency instruction:', error);
      throw error;
    }
  }

  /**
   * Get the full medical/info document for a user.
   */
  async getEmergencyInstruction(uid: string): Promise<any> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error('Error getting emergency instruction:', error);
      throw error;
    }
  }

  /**
   * Update emergency message details.
   * Writes to medical/info.emergencyMessage.
   */
  async updateEmergencyMessage(
    uid: string,
    emergencyMessage: EmergencyMessage
  ): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      await updateDoc(medicalRef, {emergencyMessage,updatedAt: new Date()});
      
    } catch (error) {
      console.error('Error updating emergency message:', error);
      throw error;
    }
  }

  /**
   * Add or update the per-allergy emergency instruction.
   * Canonical path: medical/info.allergyEmergencyInstructions[] (root array — NOT nested
   * under emergencySettings). This replaces the old
   * emergencySettings.emergencyInstructions write path.
   */
  async setEmergencyInstructionForAllergy(
    uid: string,
    allergyId: string,
    allergyName: string,
    instruction: string
  ): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      let allergyEmergencyInstructions: EmergencyInstruction[] = [];

      if (userDoc.exists()) {
        const data = userDoc.data();
        // Read from canonical root path only.
        allergyEmergencyInstructions = data['allergyEmergencyInstructions'] ?? [];
      }

      // Replace the entry for this allergy (upsert by allergyId)
      allergyEmergencyInstructions = allergyEmergencyInstructions.filter(
        ei => ei.allergyId !== allergyId
      );
      allergyEmergencyInstructions.push({ allergyId, allergyName, instruction });

      await updateDoc(medicalRef, {
        allergyEmergencyInstructions, 
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error setting emergency instruction for allergy:', error);
      throw error;
    }
  }

  /**
   * Get per-allergy emergency instructions.
   * Reads from canonical root path: medical/info.allergyEmergencyInstructions[].
   */
  async getEmergencyInstructions(uid: string): Promise<EmergencyInstruction[]> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        return data['allergyEmergencyInstructions'] ?? [];
      }

      return [];
    } catch (error) {
      console.error('Error getting emergency instructions:', error);
      throw error;
    }
  }

  /**
   * Remove per-allergy emergency instruction by allergyId.
   */
  async removeEmergencyInstructionForAllergy(
    uid: string,
    allergyId: string
  ): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        const filtered = (data['allergyEmergencyInstructions'] ?? [] as EmergencyInstruction[])
          .filter((ei: EmergencyInstruction) => ei.allergyId !== allergyId);

        await updateDoc(medicalRef, {
          allergyEmergencyInstructions: filtered,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error('Error removing emergency instruction for allergy:', error);
      throw error;
    }
  }

  /**
   * Get the user's complete medical/info document.
   */
  async getUserMedicalProfile(uid: string): Promise<MedicalInfo | null> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      return userDoc.exists() ? userDoc.data() as MedicalInfo : null;
    } catch (error) {
      console.error('Error getting medical profile:', error);
      throw error;
    }
  }


  /**
   * Get all emergency-relevant data for alert display.
   * Reads from canonical paths only — no more emergencySettings fallback.
   */
  async getEmergencyData(uid: string): Promise<any> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (userDoc.exists()) {
        const data = userDoc.data();

        const emergencyMessage = data['emergencyMessage'] ?? {};
        const generalEmergencyInstruction = data['generalEmergencyInstruction'] ?? '';
        const allergyEmergencyInstructions: EmergencyInstruction[] = data['allergyEmergencyInstructions'] ?? [];

        return {
          generalEmergencyInstruction,
          allergyEmergencyInstructions,
          emergencyMessage: {
            ...emergencyMessage,
            location: emergencyMessage['location'] ?? ''
          },
          emergencyLocation: data['emergencyLocation'] ?? null,
          name: emergencyMessage['name'] ?? '',
          allergies: emergencyMessage['allergies'] ?? '',
          uid
        };
      }

      return null;
    } catch (error) {
      console.error('Error getting emergency data:', error);
      throw error;
    }
  }



  async updateMedicalInfo(
  uid: string,
  updates: Partial<MedicalInfo>
): Promise<void> {
  try {
    await updateDoc(
      doc(this.db, 'users', uid, 'medical', 'info'),
      {
        ...updates,
        updatedAt: new Date()
      }
    );
  } catch (error) {
    console.error('Error updating medical info:', error);
    throw error;
  }
}


  // Check if user has completed allergy onboarding
async hasCompletedAllergyOnboarding(uid: string): Promise<boolean> {
  try {
    const medicalInfo = await this.getUserMedicalProfile(uid);

    if (medicalInfo?.allergyOnboardingCompleted) {
      return true;
    }

    const allergies = Array.isArray(medicalInfo?.allergies)
      ? medicalInfo.allergies
      : [];

    return allergies.length > 0;

  } catch (error) {
    console.error('Error checking allergy onboarding status:', error);
    return false;
  }
}

    // Mark allergy onboarding as completed
  async markAllergyOnboardingCompleted(uid: string): Promise<void> {
    try {
      await setDoc(doc(this.db, 'users', uid, 'medical', 'info'), {
        allergyOnboardingCompleted: true
      }, { merge: true });
      console.log('Allergy onboarding marked as completed');
    } catch (error) {
      console.error('Error marking allergy onboarding as completed:', error);
      throw error;
    }
  }



}