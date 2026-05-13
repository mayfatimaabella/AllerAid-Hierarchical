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
   * Set the general emergency instruction string for a user.
   * Writes to medical/info.emergencyInstruction (root field).
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

      await updateDoc(medicalRef, {
        emergencyMessage,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating emergency message:', error);
      throw error;
    }
  }

  /**
   * Add or update the per-allergy emergency instruction.
   * Canonical path: medical/info.emergencyInstructions[] (root array — NOT nested
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

      let emergencyInstructions: EmergencyInstruction[] = [];

      if (userDoc.exists()) {
        const data = userDoc.data();
        // Read from canonical root path only.
        // Legacy fallback removed — migrate any old data with migrateEmergencyInstructions().
        emergencyInstructions = data['emergencyInstructions'] ?? [];
      }

      // Replace the entry for this allergy (upsert by allergyId)
      emergencyInstructions = emergencyInstructions.filter(
        ei => ei.allergyId !== allergyId
      );
      emergencyInstructions.push({ allergyId, allergyName, instruction });

      await updateDoc(medicalRef, {
        emergencyInstructions,   // root field — canonical location
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error setting emergency instruction for allergy:', error);
      throw error;
    }
  }

  /**
   * Get per-allergy emergency instructions.
   * Reads from canonical root path: medical/info.emergencyInstructions[].
   */
  async getEmergencyInstructions(uid: string): Promise<EmergencyInstruction[]> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        return data['emergencyInstructions'] ?? [];
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
        const filtered = (data['emergencyInstructions'] ?? [] as EmergencyInstruction[])
          .filter((ei: EmergencyInstruction) => ei.allergyId !== allergyId);

        await updateDoc(medicalRef, {
          emergencyInstructions: filtered,
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
  async getUserMedicalProfile(uid: string): Promise<any> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);
      return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
      console.error('Error getting medical profile:', error);
      throw error;
    }
  }

  /**
   * REMOVED: saveEmergencySettings() previously wrote an emergencySettings
   * object to medical/info, conflicting with settings/preferences.emergencySettings
   * (which owns the toggle booleans shakeToAlert, powerButtonAlert,
   * audioInstructions). Use UserService.updateUserProfile({ emergencySettings })
   * to update those toggles instead.
   *
   * If you need to persist a generalInstruction string, use
   * setEmergencyInstruction() which writes to medical/info.emergencyInstruction.
   */

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
        const emergencyInstruction = data['emergencyInstruction'] ?? '';
        const emergencyInstructions: EmergencyInstruction[] = data['emergencyInstructions'] ?? [];

        return {
          emergencyInstruction,
          emergencyInstructions,
          emergencyMessage: {
            ...emergencyMessage,
            instructions: emergencyInstruction,
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

  /**
   * Update the emergency location stored inside medical/info.
   * Note: UserService.updateEmergencyLocation() writes to the dedicated
   * emergency/active subcollection for frequent live updates. This method
   * is for persisting the last-known location inside the medical record.
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
    } catch (error) {
      console.error('Error updating emergency location:', error);
      throw error;
    }
  }

  /**
   * One-time migration: moves any instructions previously written to the
   * old emergencySettings.emergencyInstructions nested path up to the
   * canonical root emergencyInstructions[] field, then deletes the
   * stale nested key. Safe to call multiple times (idempotent).
   */
  async migrateEmergencyInstructions(uid: string): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);
      const userDoc = await getDoc(medicalRef);

      if (!userDoc.exists()) return;

      const data = userDoc.data();
      const nested: EmergencyInstruction[] =
        data['emergencySettings']?.['emergencyInstructions'] ?? [];

      if (nested.length === 0) return; // nothing to migrate

      const existing: EmergencyInstruction[] = data['emergencyInstructions'] ?? [];

      // Merge: root entries win on collision (they are newer writes)
      const existingIds = new Set(existing.map(e => e.allergyId));
      const merged = [
        ...existing,
        ...nested.filter(n => !existingIds.has(n.allergyId))
      ];

      await updateDoc(medicalRef, {
        emergencyInstructions: merged,
        'emergencySettings.emergencyInstructions': deleteField(),
        updatedAt: new Date()
      });

      console.log(`Migrated ${nested.length} legacy instruction(s) for uid: ${uid}`);
    } catch (error) {
      console.error('Error migrating emergency instructions:', error);
      throw error;
    }
  }

  /** Testing utility — removes the location field from emergencyMessage. */
  async removeEmergencyMessageLocation(uid: string): Promise<void> {
    try {
      const medicalRef = doc(this.db, `users/${uid}/medical/info`);

      await updateDoc(medicalRef, {
        'emergencyMessage.location': deleteField(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error removing emergency message location:', error);
      throw error;
    }
  }
}