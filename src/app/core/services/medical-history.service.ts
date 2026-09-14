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
  serverTimestamp
} from 'firebase/firestore';

import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

export interface MedicalHistory {
  id?: string;
  patientId: string;
  condition: string;
  diagnosisDate: string;
  status: 'active' | 'resolved' | 'chronic' | 'not-cured';
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

@Injectable({
  providedIn: 'root'
})
export class MedicalHistoryService {

  private db: any;

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.db = this.firebaseService.getDb();
  }

  /**
   * Firestore path:
   * users/{patientId}/healthRecords/summary/medicalHistory
   */
  private medicalHistoryPath(patientId: string): string {
    return `users/${patientId}/healthRecords/summary/medicalHistory`;
  }

  /**
   * Add a medical history record
   */
  async addMedicalHistory(
    historyData: Omit<MedicalHistory, 'id' | 'patientId'>
  ): Promise<void> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const cleanedData = {
      condition:
        historyData.condition?.trim() || '',

      diagnosisDate:
        historyData.diagnosisDate || '',

      status:
        historyData.status,

      notes:
        historyData.notes?.trim() || '',

      patientId:
        currentUser.uid,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()
    };

    await addDoc(
      collection(
        this.db,
        this.medicalHistoryPath(currentUser.uid)
      ),
      cleanedData
    );
  }

  /**
   * Get all medical history records
   */
  async getMedicalHistory(): Promise<MedicalHistory[]> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const q = query(
      collection(
        this.db,
        this.medicalHistoryPath(currentUser.uid)
      ),
      orderBy('diagnosisDate', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as MedicalHistory[];
  }

  /**
   * Get one medical history record
   */
  async getMedicalHistoryById(
    recordId: string
  ): Promise<MedicalHistory | null> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const ref = doc(
      this.db,
      this.medicalHistoryPath(currentUser.uid),
      recordId
    );

    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    } as MedicalHistory;
  }

  /**
   * Update a medical history record
   */
  async updateMedicalHistory(
    historyId: string,
    historyData: Partial<MedicalHistory>
  ): Promise<void> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const ref = doc(
      this.db,
      this.medicalHistoryPath(currentUser.uid),
      historyId
    );

    const cleanedUpdate: any = {
      updatedAt: serverTimestamp()
    };

    if (historyData.condition !== undefined) {
      cleanedUpdate.condition =
        historyData.condition?.trim() || '';
    }

    if (historyData.diagnosisDate !== undefined) {
      cleanedUpdate.diagnosisDate =
        historyData.diagnosisDate;
    }

    if (historyData.status !== undefined) {
      cleanedUpdate.status =
        historyData.status;
    }

    if (historyData.notes !== undefined) {
      cleanedUpdate.notes =
        historyData.notes?.trim() || '';
    }

    await updateDoc(ref, cleanedUpdate);
  }

  /**
   * Delete a medical history record
   */
  async deleteMedicalHistory(
    historyId: string
  ): Promise<void> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const ref = doc(
      this.db,
      this.medicalHistoryPath(currentUser.uid),
      historyId
    );

    await deleteDoc(ref);
  }
}
