import { Injectable } from '@angular/core';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

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
  emergencyInstruction: string; // Keep for backward compatibility
  emergencyInstructions: EmergencyInstruction[]; // New structured format
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
      await setDoc(medicalRef, { 
        emergencyInstruction: instruction,
        updatedAt: new Date()
      }, { merge: true });
      
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
      } else {
        console.log('No emergency instruction found for user');
        return null;
      }
    } catch (error) {
      console.error('Error getting emergency instruction:', error);
      throw error;
    }
  }

  /**
   * Update emergency message details
   */
  async updateEmergencyMessage(uid: string, emergencyMessage: EmergencyMessage): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      await updateDoc(medicalRef, {
        emergencyMessage: emergencyMessage,
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
  async setEmergencyInstructionForAllergy(uid: string, allergyId: string, allergyName: string, instruction: string): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);
      
      let emergencyInstructions: EmergencyInstruction[] = [];
      
      if (userDoc.exists() && userDoc.data()['emergencyInstructions']) {
        emergencyInstructions = userDoc.data()['emergencyInstructions'];
      }
      
      // Remove existing instruction for this allergy
      emergencyInstructions = emergencyInstructions.filter(ei => ei.allergyId !== allergyId);
      
      // Add new instruction
      emergencyInstructions.push({
        allergyId,
        allergyName,
        instruction
      });
      
      await updateDoc(medicalRef, {
        emergencyInstructions,
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
      
      if (userDoc.exists() && userDoc.data()['emergencyInstructions']) {
        return userDoc.data()['emergencyInstructions'];
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
  async removeEmergencyInstructionForAllergy(uid: string, allergyId: string): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);
      
      if (userDoc.exists() && userDoc.data()['emergencyInstructions']) {
        let emergencyInstructions: EmergencyInstruction[] = userDoc.data()['emergencyInstructions'];
        emergencyInstructions = emergencyInstructions.filter(ei => ei.allergyId !== allergyId);
        
        await updateDoc(medicalRef, {
          emergencyInstructions,
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
      } else {
        console.log('No medical profile found for user');
        return null;
      }
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

        // Save emergency instructions together
        emergencyInstructions: settings.emergencyInstructions || [],

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
   * Get complete emergency data for alerts (instruction + message + location)
   */
  async getEmergencyData(uid: string): Promise<any> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          emergencyInstruction: userData['emergencyInstruction'] || '',
          emergencyMessage: userData['emergencyMessage'] || {},
          emergencyLocation: userData['emergencyLocation'] || null,
          name: userData['fullName'] || '',
          allergies: userData['emergencyMessage']?.allergies || '',
          uid: uid
        };
      } else {
        console.log('No emergency data found for user');
        return null;
      }
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

  /**
   * Generate emergency alert payload for SMS/push notifications
   */
  generateEmergencyAlertPayload(emergencyData: any, currentLocation?: any): string {
    const { name, allergies, emergencyInstruction, emergencyMessage } = emergencyData;
    
    let alertMessage = `ALLERGY EMERGENCY \n`;
    alertMessage += `Name: ${name}\n`;
    
    if (allergies && allergies !== 'None') {
      alertMessage += `Allergies: ${allergies}\n`;
    }
    
    if (emergencyInstruction) {
      alertMessage += `Instructions: ${emergencyInstruction}\n`;
    } else if (emergencyMessage?.instructions) {
      alertMessage += `Instructions: ${emergencyMessage.instructions}\n`;
    }
    
    if (currentLocation) {
      alertMessage += `Location: https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}\n`;
    }
    
    alertMessage += `\nRespond immediately! This is an automated emergency alert.`;
    
    return alertMessage;
  }

  /**
   * Migration function to update existing emergency messages from "Google Maps" to "Map Location"
   * This should be called once to update all existing documents
   */
  async migrateEmergencyMessageLocations(): Promise<number> {
    try {
      console.log('Starting emergency message location migration...');
      
      // Query all user profiles that have emergency message with "Google Maps"
      const userProfilesQuery = query(
        collection(this.db, 'users'),
        where('emergencyMessage.location', '==', 'Google Maps')
      );
      
      const snapshot = await getDocs(userProfilesQuery);
      
      if (snapshot.empty) {
        console.log('No user profiles found with "Google Maps" emergency location');
        return 0;
      }
      
      // Batch update for better performance
      const batch = writeBatch(this.db);
      let updateCount = 0;
      
      snapshot.docs.forEach((docSnapshot) => {
        const docRef = docSnapshot.ref;
        batch.update(docRef, {
          'emergencyMessage.location': 'Map Location',
          updatedAt: new Date()
        });
        updateCount++;
      });
      
      // Commit the batch update
      await batch.commit();
      
      console.log(`Successfully migrated ${updateCount} user profiles from "Google Maps" to "Map Location"`);
      return updateCount;
      
    } catch (error) {
      console.error('Error during emergency message migration:', error);
      throw error;
    }
  }

  /**
   * Migration function for medical profiles that have "Google Maps" in emergency settings
   */
  async migrateMedicalProfileLocations(): Promise<number> {
    try {
      console.log('Starting medical profile location migration...');
      
      // Query all medical profiles that have emergency message with "Google Maps"
      const medicalProfilesQuery = query(
        collection(this.db, 'medicalProfiles'),
        where('emergencyMessage.location', '==', 'Google Maps')
      );
      
      const snapshot = await getDocs(medicalProfilesQuery);
      
      if (snapshot.empty) {
        console.log('No medical profiles found with "Google Maps" emergency location');
        return 0;
      }
      
      // Batch update for better performance
      const batch = writeBatch(this.db);
      let updateCount = 0;
      
      snapshot.docs.forEach((docSnapshot) => {
        const docRef = docSnapshot.ref;
        batch.update(docRef, {
          'emergencyMessage.location': 'Map Location',
          updatedAt: new Date()
        });
        updateCount++;
      });
      
      // Commit the batch update
      await batch.commit();
      
      console.log(`Successfully migrated ${updateCount} medical profiles from "Google Maps" to "Map Location"`);
      return updateCount;
      
    } catch (error) {
      console.error('Error during medical profile migration:', error);
      throw error;
    }
  }

  /**
   * Run complete migration for both user profiles and medical profiles
   */
  async runLocationMigration(): Promise<{ userProfiles: number; medicalProfiles: number }> {
    try {
      console.log('Starting complete location migration...');
      
      const userProfilesUpdated = await this.migrateEmergencyMessageLocations();
      const medicalProfilesUpdated = await this.migrateMedicalProfileLocations();
      
      const totalUpdated = userProfilesUpdated + medicalProfilesUpdated;
      console.log(`Migration completed! Updated ${totalUpdated} documents total`);
      
      return {
        userProfiles: userProfilesUpdated,
        medicalProfiles: medicalProfilesUpdated
      };
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}

