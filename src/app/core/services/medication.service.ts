import { Injectable } from '@angular/core';
import { 
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, query, orderBy, Timestamp
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
  lastTakenAt?: string; 
  lastSkippedAt?: string;
  lastReminderAction?: 'taken' | 'skipped' | 'opened';
  allergicReaction?: boolean;
  status?: 'Ongoing' | 'Active' | 'Completed' | 'Incomplete' | 'Expired' | 'Overdue' | 'Inactive';
}

@Injectable({ providedIn: 'root' })
export class MedicationService {
  private db: any;
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
      console.log(`DEBUG MedicationService: Found ${meds.length} medications.`);
      this.medicationsSubject.next(meds);
    } catch (error) {
      console.error('DEBUG MedicationService: Error refreshing medications:', error);
    }
  }

  async addMedication(medication: Medication, prescriptionImageData?: string): Promise<void> {
    const uid = await this.getUid();
    const medsRef = collection(this.db, `users/${uid}/medications`);
    const cleanData = JSON.parse(JSON.stringify(medication));
    
    await addDoc(medsRef, { 
      ...cleanData, 
      prescriptionImageUrl: prescriptionImageData || null, 
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    console.log('DEBUG MedicationService: Medication added.');
    await this.refreshMedications();
  }

  async updateMedication(medicationId: string, updates: Partial<Medication>): Promise<void> {
    const uid = await this.getUid();
    const medRef = doc(this.db, `users/${uid}/medications/${medicationId}`);
    const cleanUpdates = JSON.parse(JSON.stringify(updates));
    
    await updateDoc(medRef, { ...cleanUpdates, updatedAt: Timestamp.now() });
    console.log(`DEBUG MedicationService: Medication ${medicationId} updated.`);
    await this.refreshMedications();
  }

  async toggleMedicationStatus(medicationId: string): Promise<void> {
    const uid = await this.getUid();
    const medRef = doc(this.db, `users/${uid}/medications/${medicationId}`);
    const medDoc = await getDoc(medRef);
    if (medDoc.exists()) {
      await updateDoc(medRef, { isActive: !medDoc.data()['isActive'], updatedAt: Timestamp.now() });
      console.log(`DEBUG MedicationService: Status toggled for ${medicationId}`);
      await this.refreshMedications();
    }
  }

  async recordReminderAction(medicationId: string, action: 'taken' | 'skipped' | 'opened'): Promise<void> {
    console.log(`DEBUG MedicationService: Recording action '${action}' for ${medicationId}`);
    const uid = await this.getUid();
    const medRef = doc(this.db, `users/${uid}/medications/${medicationId}`);
    const medSnap = await getDoc(medRef);
    
    if (!medSnap.exists()) return;
    
    const medData = medSnap.data() as Medication;
    const updateData: any = { lastReminderAction: action, updatedAt: Timestamp.now() };

    if (action === 'taken') {
      const doseSize = medData.pillsPerDose || 1;
      const currentQty = medData.refillsRemaining ?? medData.quantity ?? 0;
      const updatedQty = Math.max(currentQty - doseSize, 0);
      
      updateData.refillsRemaining = updatedQty;
      updateData.lastTakenAt = new Date().toISOString(); 
      updateData.status = updatedQty <= 0 ? 'Completed' : 'Ongoing';
      
      if (updatedQty <= 0) updateData.isActive = false;
      console.log(`DEBUG MedicationService: Pill count updated to ${updatedQty}`);
    } else if (action === 'skipped') {
      updateData.lastSkippedAt = new Date().toISOString();
    }
    
    await updateDoc(medRef, updateData);
    console.log(`DEBUG MedicationService: Action recorded in Firestore.`);
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
    console.log(`DEBUG MedicationService: Deleting ${medicationId}`);
    const uid = await this.getUid();
    await deleteDoc(doc(this.db, `users/${uid}/medications/${medicationId}`));
    console.log(`DEBUG MedicationService: Deleted successfully.`);
    await this.refreshMedications();
  }

  isOverdue(medication: Medication): boolean {
    if (!medication.lastTakenAt || medication.status === 'Completed') return false;
    const lastTaken = new Date(medication.lastTakenAt).getTime();
    const intervalMs = (medication.intervalHours || 24) * 60 * 60 * 1000;
    const nextDue = lastTaken + intervalMs;
    return new Date().getTime() > nextDue;
  }

  isExpired(medication: Medication): boolean {
    return medication.medicineExpiryDate ? new Date(medication.medicineExpiryDate) < new Date() : false;
  }
}