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
  isPastEndDate?: boolean;
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
    
    // Generate reminderTimes if not already set
    if ((!cleanData.reminderTimes || cleanData.reminderTimes.length === 0) && cleanData.startTime && cleanData.intervalHours) {
      cleanData.reminderTimes = this.calculateReminderTimes(cleanData);
    }
    
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
    
    // Generate reminderTimes if not already set but startTime and intervalHours are provided
    if ((!cleanUpdates.reminderTimes || cleanUpdates.reminderTimes.length === 0) && cleanUpdates.startTime && cleanUpdates.intervalHours) {
      cleanUpdates.reminderTimes = this.calculateReminderTimes(cleanUpdates);
    }
    
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
      
      // Set status correctly: Completed if no pills left, otherwise Ongoing (even if was Overdue)
      updateData.status = updatedQty <= 0 ? 'Completed' : 'Ongoing';
      
      if (updatedQty <= 0) updateData.isActive = false;
      console.log(`DEBUG MedicationService: Pill count updated to ${updatedQty}`);
    } else if (action === 'skipped') {
      updateData.lastSkippedAt = new Date().toISOString();
      // Don't change the status when skipping - let isOverdue() handle it
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

  // In medication.service.ts

isOverdue(medication: Medication): boolean {
  if (medication.status === 'Completed' || !medication.isActive) return false;

  // 1. Calculate reminderTimes if not available
  let reminderTimes = medication.reminderTimes;
  if (!reminderTimes || reminderTimes.length === 0) {
    reminderTimes = this.calculateReminderTimes(medication);
  }

  // 2. Fallback for interval-based check if no reminder times
  if (!reminderTimes || reminderTimes.length === 0) {
    if (!medication.lastTakenAt) return false;
    const lastTaken = new Date(medication.lastTakenAt).getTime();
    const intervalMs = (medication.intervalHours || 24) * 60 * 60 * 1000;
    return new Date().getTime() > (lastTaken + intervalMs);
  }

  // 3. Schedule-based check: Only TAKEN doses count, not SKIPPED
  const now = new Date();
  const lastTaken = medication.lastTakenAt ? new Date(medication.lastTakenAt) : null;

  for (const timeStr of reminderTimes) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);

    // If this scheduled time has passed
    if (scheduledTime < now) {
      // Check if we have TAKEN this specific dose (not skipped)
      const doseTaken = lastTaken && lastTaken >= scheduledTime;
      
      // If no TAKEN action for this scheduled slot, it is overdue
      if (!doseTaken) {
        return true;
      }
    }
  }

  return false;
}

private calculateIntervalOverdue(medication: Medication): boolean {
  if (!medication.lastTakenAt || medication.status === 'Completed') return false;
  const lastTaken = new Date(medication.lastTakenAt).getTime();
  const intervalMs = (medication.intervalHours || 24) * 60 * 60 * 1000;
  return new Date().getTime() > (lastTaken + intervalMs);
}

/**
 * Calculate reminder times based on start time and interval hours
 */
private calculateReminderTimes(medication: Medication): string[] {
  if (!medication.startTime || !medication.intervalHours) return [];

  const times: string[] = [];
  const [startHour, startMin] = medication.startTime.split(':').map(Number);
  const intervalMs = medication.intervalHours * 60 * 60 * 1000;
  
  // Generate times throughout the day
  let currentTime = new Date();
  currentTime.setHours(startHour, startMin, 0, 0);
  
  // Generate up to 5 reminder times (or until end of day)
  for (let i = 0; i < 5; i++) {
    if (currentTime.getHours() >= 24) break; // Stop if past midnight
    times.push(`${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`);
    currentTime.setTime(currentTime.getTime() + intervalMs);
  }
  
  return times;
}

  isExpired(medication: Medication): boolean {
    return medication.medicineExpiryDate ? new Date(medication.medicineExpiryDate) < new Date() : false;
  }

 isPastEndDate(medication: any): boolean {
  // 1. Safety check: If medication or expiryDate is missing, it's not past the end date
  if (!medication || !medication.expiryDate) return false;

  try {
    // 2. Normalize to a JavaScript Date object
    // Handles Firebase Timestamp (.toDate()) or standard date/string
    const endDate = (medication.expiryDate.toDate && typeof medication.expiryDate.toDate === 'function')
      ? medication.expiryDate.toDate()
      : new Date(medication.expiryDate);

    // 3. Final validation: Ensure the date object is valid
    if (isNaN(endDate.getTime())) {
      console.warn("Invalid date format:", medication.expiryDate);
      return false;
    }

    // 4. Set times to midnight for a clean "Day vs Day" comparison
    endDate.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 5. Returns true if today is strictly after the end date
    return now > endDate;
  } catch (error) {
    console.error("Error calculating past end date:", error);
    return false;
  }
}
}