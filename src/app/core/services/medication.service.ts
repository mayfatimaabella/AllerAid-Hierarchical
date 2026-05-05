import { Injectable } from '@angular/core';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  query,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

/**
 * Enhanced Medication Interface
 */
export interface Medication {
  id?: string;
  name: string;
  brandName?: string;          
  dosage: string; 
  dosageAmount?: number; 
  dosageUnit?: string;         // e.g., 'tablet(s)', 'ml', 'puff(s)'
  frequency: string; 
  
  // Calculation & Scheduling Fields
  intervalHours?: number;      
  pillsPerDose: number;        
  durationDays: number;        
  startDate: string;           // ISO String
  endDate?: string;            
  expiryDate?: string;         // Treatment End Date (Auto-calculated)
  medicineExpiryDate: string;  // Physical shelf life of the medicine
  
  notes: string;
  category: 'allergy' | 'emergency' | 'daily' | 'asNeeded' | 'other';
  isActive: boolean;
  prescribedBy?: string;
  sideEffects?: string;
  instructions?: string;
  refillDate?: string;
  createdAt?: any;             
  updatedAt?: any;

  // Inventory & Type
  medicationType: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'inhaler' | 'cream' | 'drops' | 'patch' | 'other';
  customMedicationType?: string; 
  quantity: number;            
  unitCost?: number;
  totalCost?: number;
  refillsRemaining?: number;   // Primary field for "Live" inventory tracking
  
  // Images
  prescriptionImageUrl?: string;
  medicationImageUrl?: string;
  
  // Reminders & Status
  reminderEnabled?: boolean;
  reminderTimes?: string[];
  lastTakenAt?: Date;
  lastSkippedAt?: Date;
  lastReminderAction?: 'taken' | 'skipped' | 'opened';
  allergicReaction?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MedicationService {
  private db;

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.db = this.firebaseService.getDb();
  }

  /**
   * Add a new medication for the current user.
   */
  async addMedication(medication: Medication, prescriptionImageData?: string, medicationImageData?: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    try {
      const medToSave = { ...medication };

      if (prescriptionImageData) medToSave.prescriptionImageUrl = prescriptionImageData;
      if (medicationImageData) medToSave.medicationImageUrl = medicationImageData;

      const medsRef = collection(this.db, `users/${currentUser.uid}/medications`);
      await addDoc(medsRef, {
        ...medToSave,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error adding medication:', error);
      throw error;
    }
  }

  /**
   * Toggle medication active status.
   */
  async toggleMedicationStatus(medicationId: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      const medDoc = await getDoc(medRef);
      
      if (medDoc.exists()) {
        const currentData = medDoc.data() as Medication;
        await updateDoc(medRef, {
          isActive: !currentData.isActive,
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error toggling medication status:', error);
      throw error;
    }
  }

  /**
   * Update an existing medication.
   */
  async updateMedication(medicationId: string, updates: Partial<Medication>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      await updateDoc(medRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    }
  }

  /**
   * Get all medications for the current user.
   */
  async getUserMedications(uid?: string): Promise<Medication[]> {
    const currentUser = await this.authService.waitForAuthInit();
    const userId = uid || currentUser?.uid;
    
    if (!userId) throw new Error('User not logged in');

    try {
      const medsRef = collection(this.db, `users/${userId}/medications`);
      const q = query(medsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Medication));
    } catch (error) {
      console.error('Error fetching medications:', error);
      throw error;
    }
  }

  /**
   * Record result of a medication reminder interaction.
   * Logic updated to sync both 'quantity' and 'refillsRemaining'.
   */
  async recordReminderAction(
    medicationId: string,
    action: 'taken' | 'skipped' | 'opened'
  ): Promise<{ newQuantity?: number, newRefills?: number } | void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      const medSnap = await getDoc(medRef);
      const medData = medSnap.exists() ? (medSnap.data() as Medication) : null;

      const updateData: any = {
        lastReminderAction: action,
        updatedAt: Timestamp.now()
      };

      if (action === 'taken' && medData) {
        updateData.lastTakenAt = new Date();
        const doseSize = medData.pillsPerDose || 1;

        // 1. Update the total stock quantity
        if (typeof medData.quantity === 'number') {
          const newQuantity = Math.max(medData.quantity - doseSize, 0);
          updateData.quantity = newQuantity;
          if (newQuantity <= 0) updateData.isActive = false;
        }

        // 2. Update the "Live" refillsRemaining count
        if (typeof medData.refillsRemaining === 'number') {
          updateData.refillsRemaining = Math.max(medData.refillsRemaining - doseSize, 0);
        }
      } else if (action === 'skipped') {
        updateData.lastSkippedAt = new Date();
      }

      await updateDoc(medRef, updateData);
      
      return { 
        newQuantity: updateData.quantity,
        newRefills: updateData.refillsRemaining
      };
    } catch (error) {
      console.error('Error recording reminder action:', error);
      throw error;
    }
  }

  /**
   * Delete a medication.
   */
  async deleteMedication(medicationId: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      await deleteDoc(medRef);
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw error;
    }
  }
}