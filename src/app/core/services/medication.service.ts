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
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

export interface Medication {
  id?: string;
  name: string;
  dosage: string;
  dosageAmount?: number; // Structured dosage amount (e.g., 50)
  dosageUnit?: string; // Structured dosage unit (e.g., "mg")
  frequency: string; // We'll use this for duration (e.g., "10 days")
  // Optional interval in hours for reminders/scheduling (e.g., 4 for every 4 hours)
  intervalHours?: number;
  startDate: string;
  endDate?: string;
  notes: string;
  category: 'allergy' | 'emergency' | 'daily' | 'asNeeded' | 'other';
  isActive: boolean;
  prescribedBy?: string;
  sideEffects?: string;
  instructions?: string;
  refillDate?: string;
  createdAt?: Date;
  updatedAt?: Date;
  // Enhanced fields (all optional for simplified form)
  medicationType?: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'inhaler' | 'cream' | 'drops' | 'patch' | 'other';
  strength?: string;
  route?: 'oral' | 'topical' | 'injection' | 'inhalation' | 'nasal' | 'ophthalmic' | 'otic';
  color?: string;
  shape?: string;
  manufacturer?: string;
  lotNumber?: string;
  expiryDate?: string;
  quantity?: number; // Number of pills
  unitCost?: number;
  totalCost?: number;
  pharmacy?: string;
  prescriptionNumber?: string;
  refillsRemaining?: number;
  reminderEnabled?: boolean;
  reminderTimes?: string[];
  allergicReaction?: boolean;
  lastTakenAt?: Date;
  lastSkippedAt?: Date;
  lastReminderAction?: 'taken' | 'skipped' | 'opened';
  // Prescription image fields
  prescriptionImageUrl?: string;
  prescriptionImageName?: string;
  medicationImageUrl?: string;
  medicationImageName?: string;
  foodRestrictions?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MedicationService {
  private db;
  private storage;

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.db = this.firebaseService.getDb();
    this.storage = this.firebaseService.getStorage();
  }

  /**
   * Check if Firebase Storage is accessible
   */
  private async checkStorageAccess(): Promise<boolean> {
    try {
      // Try to create a reference to test access
      const testRef = ref(this.storage, 'test/access-check.txt');
      return true;
    } catch (error) {
      console.warn('Firebase Storage access check failed:', error);
      return false;
    }
  }

  /**
   * Upload image to Firebase Storage and return download URL
   */
  private async uploadImageToStorage(file: File, path: string): Promise<string> {
    try {
      console.log(`Attempting to upload ${file.name} (${file.size} bytes) to ${path}`);
      const storageRef = ref(this.storage, path);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Image uploaded successfully:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image to Firebase Storage:', error);
      
      // Provide more specific error information
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        // Check for specific Firebase Storage errors
        if (error.message.includes('storage/unauthorized')) {
          console.error('Firebase Storage: Unauthorized access - check security rules');
        } else if (error.message.includes('storage/quota-exceeded')) {
          console.error('Firebase Storage: Quota exceeded');
        } else if (error.message.includes('storage/invalid-argument')) {
          console.error('Firebase Storage: Invalid file or path');
        }
      }
      
      throw error;
    }
  }

  /**
   * Convert data URL to File object
   */
  private dataURLtoFile(dataURL: string, filename: string): File {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  /**
   * Add a new medication for the current user
   */
  async addMedication(medication: Medication, prescriptionImageData?: string, medicationImageData?: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    console.log('Current user authenticated:', {
      uid: currentUser.uid,
      email: currentUser.email
    });

    try {
      // For now, use compressed base64 storage due to Firebase Storage access issues
      // TODO: Fix Firebase Storage rules and re-enable cloud storage
      
      if (prescriptionImageData) {
        console.log('Storing prescription image as compressed base64');
        console.log('Prescription image size:', prescriptionImageData.length, 'characters');
        medication.prescriptionImageUrl = prescriptionImageData;
      }

      if (medicationImageData) {
        console.log('Storing medication image as compressed base64');
        console.log('Medication image size:', medicationImageData.length, 'characters');
        medication.medicationImageUrl = medicationImageData;
      }

      console.log('Adding medication to Firestore...');
      const medsRef = collection(this.db, `users/${currentUser.uid}/medications`);
      await addDoc(medsRef, {
        ...medication,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      console.log('Medication added successfully with compressed images');
    } catch (error) {
      console.error('Error adding medication:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error name:', error.name);
      }
      throw error;
    }
  }

  /**
   * Get all medications for the current user
   */
  async getUserMedications(uid?: string): Promise<Medication[]> {
    const currentUser = await this.authService.waitForAuthInit();
    const userId = uid || currentUser?.uid;
    
    if (!userId) {
      throw new Error('User not logged in');
    }

    try {
      const medsRef = collection(this.db, `users/${userId}/medications`);
      const q = query(medsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const medications: Medication[] = [];
      querySnapshot.forEach((doc) => {
        medications.push({ id: doc.id, ...doc.data() } as Medication);
      });
      
      return medications;
    } catch (error) {
      console.error('Error getting medications:', error);
      throw error;
    }
  }

  /**
   * Update an existing medication
   */
  async updateMedication(medicationId: string, updates: Partial<Medication>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      await updateDoc(medRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
      
      console.log('Medication updated successfully');
    } catch (error) {
      console.error('Error updating medication:', error);
      throw error;
    }
  }

  /**
   * Delete a medication
   */
  async deleteMedication(medicationId: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      await deleteDoc(medRef);
      
      console.log('Medication deleted successfully');
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw error;
    }
  }

  /**
   * Get medications by category
   */
  async getUserMedicationsByCategory(category: string): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    return allMedications.filter(med => med.category === category);
  }

  /**
   * Get only active medications
   */
  async getActiveMedications(): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    return allMedications.filter(med => med.isActive);
  }

  /**
   * Get emergency medications (priority medications)
   */
  async getEmergencyMedications(): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    return allMedications.filter(med => 
      med.category === 'emergency' || 
      med.category === 'allergy'
    );
  }

  /**
   * Toggle medication active status
   */
  async toggleMedicationStatus(medicationId: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      const medDoc = await getDoc(medRef);
      
      if (medDoc.exists()) {
        const currentData = medDoc.data() as Medication;
        await updateDoc(medRef, {
          isActive: !currentData.isActive,
          updatedAt: new Date()
        });
        console.log('Medication status toggled successfully');
      }
    } catch (error) {
      console.error('Error toggling medication status:', error);
      throw error;
    }
  }

  /**
   * Get medications by prescriber
   */
  async getMedicationsByPrescriber(prescriber: string): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    return allMedications.filter(med => 
      med.prescribedBy?.toLowerCase().includes(prescriber.toLowerCase())
    );
  }

  /**
   * Search medications by name or notes
   */
  async searchMedications(searchTerm: string): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    const term = searchTerm.toLowerCase();
    return allMedications.filter(med => 
      med.name.toLowerCase().includes(term) ||
      med.notes?.toLowerCase().includes(term) ||
      med.dosage.toLowerCase().includes(term)
    );
  }

  /**
   * Get medications expiring soon (within 30 days)
   */
  async getExpiringMedications(): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return allMedications.filter(med => {
      if (!med.expiryDate) return false;
      const expiryDate = new Date(med.expiryDate);
      return expiryDate <= thirtyDaysFromNow && med.isActive;
    });
  }

  /**
   * Get medications needing refill
   */
  async getMedicationsNeedingRefill(): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    return allMedications.filter(med => 
      med.refillsRemaining !== undefined && 
      med.refillsRemaining <= 1 && 
      med.isActive
    );
  }

  /**
   * Get emergency medications only
   */
  async getEmergencyOnlyMedications(): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    return allMedications.filter(med => 
      (med as any).emergencyMedication === true || 
      med.allergicReaction === true || 
      med.category === 'emergency' ||
      med.category === 'allergy'
    );
  }

  /**
   * Get medications by type
   */
  async getMedicationsByType(type: string): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    return allMedications.filter(med => med.medicationType === type);
  }

  /**
   * Get medications that require special storage
   */
  async getSpecialStorageMedications(): Promise<Medication[]> {
    const allMedications = await this.getUserMedications();
    return allMedications.filter(med => 
      (med as any).requiresRefrigeration === true || med.category === 'daily' // fallback: daily meds may require refrigeration
    );
  }

  /**
   * Create medication reminder
   */
  async setMedicationReminder(medicationId: string, reminderTimes: string[]): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      await updateDoc(medRef, {
        reminderEnabled: true,
        reminderTimes: reminderTimes,
        updatedAt: new Date()
      });
      console.log('Medication reminder set successfully');
    } catch (error) {
      console.error('Error setting medication reminder:', error);
      throw error;
    }
  }

  /**
   * Update medication inventory
   */
  async updateMedicationInventory(medicationId: string, quantity: number, cost?: number): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      const updateData: any = {
        quantity: quantity,
        updatedAt: new Date()
      };
      
      if (cost !== undefined) {
        updateData.unitCost = cost;
        updateData.totalCost = quantity * cost;
      }

      await updateDoc(medRef, updateData);
      console.log('Medication inventory updated successfully');
    } catch (error) {
      console.error('Error updating medication inventory:', error);
      throw error;
    }
  }

  /**
   * Record result of a medication reminder interaction
   */
  async recordReminderAction(
    medicationId: string,
    action: 'taken' | 'skipped' | 'opened'
  ): Promise<{ newQuantity?: number } | void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const medRef = doc(this.db, `users/${currentUser.uid}/medications/${medicationId}`);
      const medSnap = await getDoc(medRef);
      const medData = medSnap.exists() ? (medSnap.data() as any) : null;

      const updateData: any = {
        lastReminderAction: action,
        updatedAt: new Date()
      };

      const now = new Date();
      if (action === 'taken') {
        updateData.lastTakenAt = now;

        // If we have a numeric quantity, treat it as
        // remaining pills and decrement by one dose.
        const currentQuantity = medData?.quantity;
        if (typeof currentQuantity === 'number' && !isNaN(currentQuantity)) {
          const newQuantity = Math.max(currentQuantity - 1, 0);
          updateData.quantity = newQuantity;

          // Automatically mark medication inactive when
          // no pills remain so it no longer counts as active.
          if (newQuantity <= 0) {
            updateData.isActive = false;
          }
        }
      } else if (action === 'skipped') {
        updateData.lastSkippedAt = now;
      }

      await updateDoc(medRef, updateData);
      console.log('Medication reminder action recorded:', medicationId, action);

      // Return the new quantity (if we computed it) so callers
      // can react, e.g. by cancelling future reminders.
      return typeof updateData.quantity === 'number'
        ? { newQuantity: updateData.quantity }
        : {};
    } catch (error) {
      console.error('Error recording medication reminder action:', error);
      throw error;
    }
  }
}

