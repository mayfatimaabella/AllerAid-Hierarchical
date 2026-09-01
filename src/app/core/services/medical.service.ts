import { Injectable } from '@angular/core';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';

import { FirebaseService } from './firebase.service';
import { MedicalInfo } from '../models/medical-info.model';
import { EmergencyInstruction } from '../models/emergency-instruction.model';

@Injectable({
  providedIn: 'root'
})
export class MedicalService {
  private db;

  constructor(
    private firebaseService: FirebaseService
  ) {
    this.db = this.firebaseService.getDb();
  }

  // Medical Profile
  
  /**
   * Get the user's complete medical/info document.
   */
  async getUserMedicalProfile(uid: string): Promise<MedicalInfo | null> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      return userDoc.exists()
        ? (userDoc.data() as MedicalInfo)
        : null;
    } catch (error) {
      console.error('Error getting medical profile:', error);
      throw error;
    }
  }

  /**
   * Update one or more fields in the user's medical profile.
   */
  async updateMedicalInfo(
    uid: string,
    updates: Partial<MedicalInfo>
  ): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      await updateDoc(medicalRef, {
        ...updates,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating medical info:', error);
      throw error;
    }
  }

  // General Emergency Instruction
  
  /**
   * Set the general emergency instruction for a user.
   */
  async setEmergencyInstruction(
    uid: string,
    instruction: string
  ): Promise<void> {
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

  // Allergy Emergency Instructions  

  /**
   * Add or update the emergency instruction for a specific allergy.
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

        allergyEmergencyInstructions =
          (data['allergyEmergencyInstructions'] ??
            []) as EmergencyInstruction[];
      }

      // Remove existing instruction for this allergy.
      allergyEmergencyInstructions =
        allergyEmergencyInstructions.filter(
          instruction => instruction.allergyId !== allergyId
        );

      // Add the new instruction.
      allergyEmergencyInstructions.push({
        allergyId,
        allergyName,
        instruction
      });

      await setDoc(
        medicalRef,
        {
          allergyEmergencyInstructions,
          updatedAt: new Date()
        },
        { merge: true }
      );
    } catch (error) {
      console.error(
        'Error setting emergency instruction for allergy:',
        error
      );
      throw error;
    }
  }

  /**
   * Get all per-allergy emergency instructions.
   */
  async getEmergencyInstructions(
    uid: string
  ): Promise<EmergencyInstruction[]> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (!userDoc.exists()) {
        return [];
      }

      const data = userDoc.data();

      return (data['allergyEmergencyInstructions'] ??
        []) as EmergencyInstruction[];
    } catch (error) {
      console.error('Error getting emergency instructions:', error);
      throw error;
    }
  }

  /**
   * Remove a per-allergy emergency instruction.
   */
  async removeEmergencyInstructionForAllergy(
    uid: string,
    allergyId: string
  ): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (!userDoc.exists()) {
        return;
      }

      const data = userDoc.data();

      const instructions = (data['allergyEmergencyInstructions'] ??
        []) as EmergencyInstruction[];

      const filteredInstructions = instructions.filter(
        instruction => instruction.allergyId !== allergyId
      );

      await updateDoc(medicalRef, {
        allergyEmergencyInstructions: filteredInstructions,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error(
        'Error removing emergency instruction for allergy:',
        error
      );
      throw error;
    }
  }

  // Emergency Message

  /**
   * Update the user's emergency message.
   *
   * If an emergency message is provided, it is saved.
   * If no message is provided, the existing emergency message
   * remains unchanged while the medical document is touched.
   */
  async updateEmergencyMessage(
    uid: string,
    emergencyMessage?: Record<string, any>
  ): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      if (emergencyMessage !== undefined) {
        await setDoc(
          medicalRef,
          {
            emergencyMessage,
            updatedAt: new Date()
          },
          { merge: true }
        );
      } else {
        await setDoc(
          medicalRef,
          {
            updatedAt: new Date()
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error('Error updating emergency message:', error);
      throw error;
    }
  }


  /**
   * Get all emergency-relevant data for alert display.
   */
  async getEmergencyData(uid: string): Promise<any | null> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (!userDoc.exists()) {
        return null;
      }

      const data = userDoc.data();

      const emergencyMessage = data['emergencyMessage'] ?? {};

      const generalEmergencyInstruction =
        data['generalEmergencyInstruction'] ?? '';

      const allergyEmergencyInstructions =
        (data['allergyEmergencyInstructions'] ??
          []) as EmergencyInstruction[];

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
    } catch (error) {
      console.error('Error getting emergency data:', error);
      throw error;
    }
  }
}
