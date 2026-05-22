import { Injectable } from '@angular/core';
import { 
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, query, orderBy, Timestamp,
  enableIndexedDbPersistence, disableNetwork, enableNetwork
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { BehaviorSubject } from 'rxjs';

export interface Medication {
  id?: string;
  name: string;
  brandName?: string;
  dosage: string;
  dosageAmount?: number;
  dosageUnit?: string;
  frequency: string;
  intervalHours?: number;
  pillsPerDose: number;
  durationDays: number;
  startDate: string;
  startTime?: string;
  endDate?: string;
  expiryDate?: string;
  medicineExpiryDate: string;
  notes: string;
  category: 'allergy' | 'emergency' | 'daily' | 'asNeeded' | 'other';
  isActive: boolean;
  prescribedBy?: string;
  sideEffects?: string;
  instructions?: string;
  refillDate?: string;
  createdAt?: any;
  updatedAt?: any;
  medicationType: 'tablet' | 'capsule' | 'liquid' | 'injection' | 'inhaler' | 'cream' | 'drops' | 'patch' | 'other';
  customMedicationType?: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  refillsRemaining?: number;
  prescriptionImageUrl?: string;
  medicationImageUrl?: string;
  reminderEnabled?: boolean;
  reminderTimes?: string[];
  lastTakenAt?: Date;
  lastSkippedAt?: Date;
  lastReminderAction?: 'taken' | 'skipped' | 'opened';
  allergicReaction?: boolean;
  status?: 'Ongoing' | 'Active' | 'Completed' | 'Incomplete' | 'Expired' | 'Overdue' | 'Inactive';
}

@Injectable({ providedIn: 'root' })
export class MedicationService {
  private db;
  private medicationsSubject = new BehaviorSubject<Medication[]>([]);
  public medications$ = this.medicationsSubject.asObservable();

  constructor(private firebaseService: FirebaseService, private authService: AuthService) {
    this.db = this.firebaseService.getDb();
  }

  private async getUid(): Promise<string> {
    const user = await this.authService.waitForAuthInit();
    if (!user) throw new Error('User not logged in');
    return user.uid;
  }

  async refreshMedications(): Promise<void> {
    console.log('DEBUG MedicationService: Refreshing medications from Firestore...');
    try {
      const meds = await this.getUserMedications();
      console.log(`DEBUG MedicationService: Found ${meds.length} medications:`, meds.map(m => ({ id: m.id, name: m.name })));
      this.medicationsSubject.next(meds);
      console.log('DEBUG MedicationService: BehaviorSubject updated with fresh medications');
    } catch (error) {
      console.error('DEBUG MedicationService: Error refreshing medications:', error);
    }
  }

  /**
   * Adds medication with strict data sanitation to prevent Firestore rejection.
   */
  async addMedication(medication: Medication, prescriptionImageData?: string): Promise<void> {
    const uid = await this.getUid();
    const medsRef = collection(this.db, `users/${uid}/medications`);
    
    // Sanitize: Remove undefined/null values that block Firestore writes
    const cleanData = JSON.parse(JSON.stringify(medication));
    
    await addDoc(medsRef, { 
      ...cleanData, 
      prescriptionImageUrl: prescriptionImageData || null, 
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    await this.refreshMedications();
  }

  async updateMedication(medicationId: string, updates: Partial<Medication>): Promise<void> {
    const uid = await this.getUid();
    const medRef = doc(this.db, `users/${uid}/medications/${medicationId}`);
    
    // Sanitize updates
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    
    await updateDoc(medRef, { ...cleanUpdates, updatedAt: Timestamp.now() });
    await this.refreshMedications();
  }

  async toggleMedicationStatus(medicationId: string): Promise<void> {
    const uid = await this.getUid();
    const medRef = doc(this.db, `users/${uid}/medications/${medicationId}`);
    const medDoc = await getDoc(medRef);
    if (medDoc.exists()) {
      await updateDoc(medRef, { isActive: !medDoc.data()['isActive'], updatedAt: Timestamp.now() });
      await this.refreshMedications();
    }
  }

  async recordReminderAction(medicationId: string, action: 'taken' | 'skipped' | 'opened'): Promise<any> {
    const uid = await this.getUid();
    const medRef = doc(this.db, `users/${uid}/medications/${medicationId}`);
    const medSnap = await getDoc(medRef);
    const medData = medSnap.data() as Medication;

    const updateData: any = { 
      lastReminderAction: action, 
      updatedAt: Timestamp.now() 
    };

    if (action === 'taken' && medData) {
      const doseSize = medData.pillsPerDose || 1;
      let updatedRefills = (medData.refillsRemaining ?? medData.quantity) - doseSize;
      
      updateData.refillsRemaining = Math.max(updatedRefills, 0);

      if (medData.status === 'Incomplete' || !medData.status) {
        updateData.status = 'Ongoing';
      }
      
      if (updatedRefills <= 0) { 
        updateData.isActive = false; 
        updateData.status = 'Completed'; 
      }

      await updateDoc(medRef, updateData);
      await this.refreshMedications();
      return { newRefills: updateData.refillsRemaining };
    }
    
    if (action === 'skipped') updateData.lastSkippedAt = new Date();
    
    await updateDoc(medRef, updateData);
    await this.refreshMedications();
  }

  async getUserMedications(uid?: string): Promise<Medication[]> {
    const userId = uid || await this.getUid();
    const medsRef = collection(this.db, `users/${userId}/medications`);
    const q = query(medsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medication));
  }

  async deleteMedication(medicationId: string): Promise<void> {
    console.log(`DEBUG MedicationService: Starting deletion for ID: ${medicationId}`);
    const uid = await this.getUid();
    const docPath = `users/${uid}/medications/${medicationId}`;
    console.log(`DEBUG MedicationService: Deleting from path: ${docPath}`);
    try {
      await deleteDoc(doc(this.db, docPath));
      console.log(`DEBUG MedicationService: Document deleted successfully from Firestore`);
      
      // Remove from local state immediately
      const currentMeds = this.medicationsSubject.value;
      const filteredMeds = currentMeds.filter(m => m.id !== medicationId);
      console.log(`DEBUG MedicationService: Removed from local state. Before: ${currentMeds.length}, After: ${filteredMeds.length}`);
      this.medicationsSubject.next(filteredMeds);
      
      // Add small delay to allow Firestore to propagate, then refresh to verify
      await new Promise(resolve => setTimeout(resolve, 500));
      await this.refreshMedications();
      console.log(`DEBUG MedicationService: Medications refreshed after deletion`);
    } catch (error) {
      console.error(`DEBUG MedicationService: Error deleting document:`, error);
      throw error;
    }
  }

  isExpired(medication: Medication): boolean {
    return medication.medicineExpiryDate ? new Date(medication.medicineExpiryDate) < new Date() : false;
  }
}