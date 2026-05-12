import { Injectable } from '@angular/core';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteField,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface EmergencyInstruction {
  allergyId: string;
  allergyName: string;
  instruction: string;
}

export interface EmergencyMessage {
  name: string;
  allergies: string;
  instructions: string;
  location: string;
}

export interface MedicalRecord {
  id?: string;
  uid: string;
  emergencyInstruction: string;
  emergencyInstructions: EmergencyInstruction[];
  emergencyMessage: EmergencyMessage;
  medications: any[];
  createdAt: Date;
  updatedAt: Date;
}

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
   * Set emergency instruction for a user
   */
  async setEmergencyInstruction(uid: string, instruction: string): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      await setDoc(
        medicalRef,
        {
          emergencyInstruction: instruction,
          updatedAt: new Date()
        },
        { merge: true }
      );

      console.log('Emergency instruction saved successfully');
    } catch (error) {
      console.error('Error saving emergency instruction:', error);
      throw error;
    }
  }

  /**
   * Get emergency instruction for a user
   */
  async getEmergencyInstruction(uid: string): Promise<any> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (userDoc.exists()) {
        return userDoc.data();
      }

      console.log('No emergency instruction found for user');
      return null;
    } catch (error) {
      console.error('Error getting emergency instruction:', error);
      throw error;
    }
  }

  /**
   * Update emergency message details
   */
  async updateEmergencyMessage(
    uid: string,
    emergencyMessage: EmergencyMessage
  ): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      await updateDoc(medicalRef, {
        emergencyMessage,
        updatedAt: new Date()
      });

      console.log('Emergency message updated successfully');
    } catch (error) {
      console.error('Error updating emergency message:', error);
      throw error;
    }
  }

  /**
   * Add or update emergency instruction for specific allergy
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

      let emergencyInstructions: EmergencyInstruction[] = [];

      if (userDoc.exists()) {
        const data = userDoc.data();

        emergencyInstructions =
          data['emergencySettings']?.['emergencyInstructions']
          ?? data['emergencyInstructions']
          ?? [];
      }

      emergencyInstructions = emergencyInstructions.filter(
        ei => ei.allergyId !== allergyId
      );

      emergencyInstructions.push({
        allergyId,
        allergyName,
        instruction
      });

      await updateDoc(medicalRef, {
        'emergencySettings.emergencyInstructions': emergencyInstructions,
        updatedAt: new Date()
      });

      console.log('Emergency instruction added/updated for allergy:', allergyName);
    } catch (error) {
      console.error('Error setting emergency instruction for allergy:', error);
      throw error;
    }
  }

  /**
   * Get emergency instructions for all allergies
   */
  async getEmergencyInstructions(uid: string): Promise<EmergencyInstruction[]> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (userDoc.exists()) {
        const data = userDoc.data();

        return (
          data['emergencySettings']?.['emergencyInstructions']
          ?? data['emergencyInstructions']
          ?? []
        );
      }

      return [];
    } catch (error) {
      console.error('Error getting emergency instructions:', error);
      throw error;
    }
  }

  /**
   * Remove emergency instruction for specific allergy
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

        let emergencyInstructions: EmergencyInstruction[] =
          data['emergencySettings']?.['emergencyInstructions']
          ?? data['emergencyInstructions']
          ?? [];

        emergencyInstructions = emergencyInstructions.filter(
          ei => ei.allergyId !== allergyId
        );

        await updateDoc(medicalRef, {
          'emergencySettings.emergencyInstructions': emergencyInstructions,
          updatedAt: new Date()
        });

        console.log('Emergency instruction removed for allergy ID:', allergyId);
      }
    } catch (error) {
      console.error('Error removing emergency instruction for allergy:', error);
      throw error;
    }
  }

  /**
   * Get user's complete medical profile
   */
  async getUserMedicalProfile(uid: string): Promise<any> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (userDoc.exists()) {
        return userDoc.data();
      }

      console.log('No medical profile found for user');
      return null;
    } catch (error) {
      console.error('Error getting medical profile:', error);
      throw error;
    }
  }

  /**
   * Save complete emergency settings
   */
  async saveEmergencySettings(uid: string, settings: any): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      await setDoc(
        medicalRef,
        {
          emergencySettings: settings,
          updatedAt: new Date()
        },
        { merge: true }
      );

      console.log('Emergency settings saved successfully');
    } catch (error) {
      console.error('Error saving emergency settings:', error);
      throw error;
    }
  }

  /**
   * Get complete emergency data for alerts
   */
async getEmergencyData(uid: string): Promise<any> {
  try {
    const medicalRef = doc(this.db, `users/${uid}/medical/info`);
    const userDoc = await getDoc(medicalRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();

      const emergencySettings = userData['emergencySettings'] || {};
      const emergencyMessage = userData['emergencyMessage'] || {};

      return {
        emergencyInstruction: emergencySettings['generalInstruction'] || '',
        emergencyInstructions: emergencySettings['emergencyInstructions'] || [],
        generalInstruction: emergencySettings['generalInstruction'] || '',

        emergencyMessage: {
          ...emergencyMessage,
          instructions: emergencySettings['generalInstruction'] || '',
          location: emergencyMessage['location'] || ''
        },

        emergencyLocation: userData['emergencyLocation'] || null,
        name: emergencyMessage['name'] || '',
        allergies: emergencyMessage['allergies'] || '',
        uid
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting emergency data:', error);
    throw error;
  }
} 

  /**
   * Update emergency location for current alert
   */
  async updateEmergencyLocation(uid: string, location: any): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      await updateDoc(medicalRef, {
        emergencyLocation: {
          ...location,
          timestamp: new Date()
        },
        updatedAt: new Date()
      });

      console.log('Emergency location updated successfully');
    } catch (error) {
      console.error('Error updating emergency location:', error);
      throw error;
    }
  }

  //for testing purposes - to remove location data
  async removeEmergencyMessageLocation(uid: string): Promise<void> {
  try {
    const medicalRef = doc(this.db, `users/${uid}/medical/info`);

    await updateDoc(medicalRef, {
      'emergencyMessage.location': deleteField(),
      updatedAt: new Date()
    });

    console.log('Emergency message location removed successfully');
  } catch (error) {
    console.error('Error removing emergency message location:', error);
    throw error;
  }
}
}