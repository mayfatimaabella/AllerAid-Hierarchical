import { Injectable } from '@angular/core';
import { collection, addDoc, getDocs, doc,updateDoc,deleteDoc,getDoc,query,orderBy,where,serverTimestamp} from 'firebase/firestore';

import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

export interface DoctorVisit {
  id?: string;
  patientId: string;
  doctorName: string;
  doctorEmail?: string;
  specialty?: string;
  visitDate: string;
  chiefComplaint: string;
  diagnosis?: string;
  notes?: string;
  status?: 'pending' | 'confirmed' | 'rejected';
  createdAt?: any;
  updatedAt?: any;
}

@Injectable({
  providedIn: 'root'
})
export class DoctorVisitService {

  private db: any;

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.db = this.firebaseService.getDb();
  }

  private doctorVisitsPath(patientId: string): string {
    return `users/${patientId}/healthRecords/summary/doctorVisits`;
  }

  /**
   * Add a doctor visit
   */
  async addDoctorVisit(
    visitData: Omit<DoctorVisit, 'id' | 'patientId'>
  ): Promise<void> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const cleanedData = {
      doctorName:
        visitData.doctorName?.trim() || '',

      doctorEmail:
        visitData.doctorEmail?.trim().toLowerCase() || '',

      specialty:
        visitData.specialty?.trim() || '',

      visitDate:
        visitData.visitDate ||
        new Date().toISOString(),

      chiefComplaint:
        visitData.chiefComplaint?.trim() || '',

      diagnosis:
        visitData.diagnosis?.trim() || '',

      notes:
        visitData.notes?.trim() || '',

      status: 'pending' as const,

      patientId: currentUser.uid,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Prevent obvious duplicate visits
    const isDuplicate =
      await this.checkDuplicateDoctorVisit(
        currentUser.uid,
        cleanedData.doctorEmail,
        cleanedData.visitDate,
        cleanedData.chiefComplaint
      );

    if (isDuplicate) {
      throw new Error(
        'A doctor visit with the same doctor, date, and reason already exists.'
      );
    }

    await addDoc(
      collection(
        this.db,
        this.doctorVisitsPath(currentUser.uid)
      ),
      cleanedData
    );
  }

  /**
   * Get all doctor visits for current patient
   */
  async getDoctorVisits(): Promise<DoctorVisit[]> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const q = query(
      collection(
        this.db,
        this.doctorVisitsPath(currentUser.uid)
      ),
      orderBy('visitDate', 'desc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(d => ({
      id: d.id,
      status: d.data()['status'] ?? 'confirmed',
      ...d.data()
    })) as DoctorVisit[];
  }

  /**
   * Get one doctor visit
   */
  async getDoctorVisitById(
    visitId: string
  ): Promise<DoctorVisit | null> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const ref = doc(
      this.db,
      this.doctorVisitsPath(currentUser.uid),
      visitId
    );

    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return null;
    }

    return {
      id: snap.id,
      status: snap.data()?.['status'] ?? 'confirmed',
      ...snap.data()
    } as DoctorVisit;
  }

  /**
   * Update doctor visit
   */
  async updateDoctorVisit(
    visitId: string,
    visitData: Partial<DoctorVisit>
  ): Promise<void> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const cleanedUpdate: any = {
      updatedAt: serverTimestamp()
    };

    if (visitData.doctorName !== undefined) {
      cleanedUpdate.doctorName =
        visitData.doctorName?.trim() || '';
    }

    if (visitData.doctorEmail !== undefined) {
      cleanedUpdate.doctorEmail =
        visitData.doctorEmail?.trim().toLowerCase() || '';
    }

    if (visitData.specialty !== undefined) {
      cleanedUpdate.specialty =
        visitData.specialty?.trim() || '';
    }

    if (visitData.visitDate !== undefined) {
      cleanedUpdate.visitDate =
        visitData.visitDate;
    }

    if (visitData.chiefComplaint !== undefined) {
      cleanedUpdate.chiefComplaint =
        visitData.chiefComplaint?.trim() || '';
    }

    if (visitData.diagnosis !== undefined) {
      cleanedUpdate.diagnosis =
        visitData.diagnosis?.trim() || '';
    }

    if (visitData.notes !== undefined) {
      cleanedUpdate.notes =
        visitData.notes?.trim() || '';
    }

    // Check duplicates when editing
    if (
      cleanedUpdate.doctorEmail &&
      cleanedUpdate.visitDate &&
      cleanedUpdate.chiefComplaint
    ) {
      const isDuplicate =
        await this.checkDuplicateDoctorVisit(
          currentUser.uid,
          cleanedUpdate.doctorEmail,
          cleanedUpdate.visitDate,
          cleanedUpdate.chiefComplaint,
          visitId
        );

      if (isDuplicate) {
        throw new Error(
          'A doctor visit with the same doctor, date, and reason already exists.'
        );
      }
    }

    const ref = doc(
      this.db,
      this.doctorVisitsPath(currentUser.uid),
      visitId
    );

    await updateDoc(ref, cleanedUpdate);
  }

  /**
   * Delete doctor visit
   */
  async deleteDoctorVisit(
    visitId: string
  ): Promise<void> {

    const currentUser =
      await this.authService.waitForAuthInit();

    if (!currentUser) {
      throw new Error('User not logged in');
    }

    const ref = doc(
      this.db,
      this.doctorVisitsPath(currentUser.uid),
      visitId
    );

    await deleteDoc(ref);
  }

  /**
   * Confirm doctor visit
   */
  async confirmDoctorVisit(
    patientId: string,
    visitId: string
  ): Promise<void> {

    const visitRef = doc(
      this.db,
      this.doctorVisitsPath(patientId),
      visitId
    );

    const visitSnap = await getDoc(visitRef);

    if (!visitSnap.exists()) {
      throw new Error('Doctor visit not found');
    }

    await updateDoc(visitRef, {
      status: 'confirmed',
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Reject doctor visit
   */
  async rejectDoctorVisit(
    patientId: string,
    visitId: string
  ): Promise<void> {

    const visitRef = doc(
      this.db,
      this.doctorVisitsPath(patientId),
      visitId
    );

    const visitSnap = await getDoc(visitRef);

    if (!visitSnap.exists()) {
      throw new Error('Doctor visit not found');
    }

    await updateDoc(visitRef, {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
  }

  /**
   * Check if a similar doctor visit already exists.
   *
   * Same:
   * - doctor
   * - date
   * - chief complaint
   *
   * is considered a duplicate.
   */
  private async checkDuplicateDoctorVisit(
    patientId: string,
    doctorEmail: string,
    visitDate: string,
    chiefComplaint: string,
    excludeVisitId?: string
  ): Promise<boolean> {

    const q = query(
      collection(
        this.db,
        this.doctorVisitsPath(patientId)
      ),
      where('doctorEmail', '==', doctorEmail),
      where('visitDate', '==', visitDate)
    );

    const snapshot = await getDocs(q);

    const normalizedComplaint =
      chiefComplaint.trim().toLowerCase();

    return snapshot.docs.some(d => {

      // Ignore the current record when editing
      if (excludeVisitId && d.id === excludeVisitId) {
        return false;
      }

      const data = d.data();

      const existingComplaint =
        (data['chiefComplaint'] || '')
          .trim()
          .toLowerCase();

      return existingComplaint === normalizedComplaint;
    });
  }
}
