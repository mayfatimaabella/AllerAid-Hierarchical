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
  visitData: Omit<DoctorVisit, 'id' | 'patientId'>,
  allowDuplicate = false
): Promise<DoctorVisit[]> {

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

  // Check for possible duplicate
  const possibleDuplicates =
    await this.findPossibleDuplicateDoctorVisits(
      currentUser.uid,
      cleanedData.doctorName,
      cleanedData.doctorEmail,
      cleanedData.visitDate
    );

  // Don't save yet. Let the UI ask the user.
  if (possibleDuplicates.length > 0 && !allowDuplicate) {
    return possibleDuplicates;
  }

  // User chose "Save Anyway", or there was no duplicate
  await addDoc(
    collection(
      this.db,
      this.doctorVisitsPath(currentUser.uid)
    ),
    cleanedData
  );

  return [];
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

  // Get the existing visit first
  const existingVisit =
    await this.getDoctorVisitById(visitId);

  if (!existingVisit) {
    throw new Error('Doctor visit not found');
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

  
  // Determine the FINAL values after the updates

  const finalDoctorName =
    cleanedUpdate.doctorName !== undefined
      ? cleanedUpdate.doctorName
      : existingVisit.doctorName;

  const finalDoctorEmail =
    cleanedUpdate.doctorEmail !== undefined
      ? cleanedUpdate.doctorEmail
      : existingVisit.doctorEmail || '';

  const finalVisitDate =
    cleanedUpdate.visitDate !== undefined
      ? cleanedUpdate.visitDate
      : existingVisit.visitDate;

  
  // Check for possible duplicate
  
  const possibleDuplicates =
    await this.findPossibleDuplicateDoctorVisits(
      currentUser.uid,
      finalDoctorName,
      finalDoctorEmail,
      finalVisitDate,
      visitId
    );

  if (possibleDuplicates.length > 0) {
    throw new Error(
      'A possible duplicate doctor visit already exists for this doctor on this date.'
    );
  }

  
  // Save update

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

    const visitRef = doc(
      this.db,
      this.doctorVisitsPath(currentUser.uid),
      visitId
    );

    const visitSnap = await getDoc(visitRef);

    if (!visitSnap.exists()) {
      throw new Error('Doctor visit not found');
    }

    await deleteDoc(visitRef);
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

  private async findPossibleDuplicateDoctorVisits(
  patientId: string,
  doctorName: string,
  doctorEmail: string,
  visitDate: string,
  excludeVisitId?: string
): Promise<DoctorVisit[]> {

  const snapshot = await getDocs(
    collection(
      this.db,
      this.doctorVisitsPath(patientId)
    )
  );

  const normalizedName =
    doctorName.trim().toLowerCase();

  const normalizedEmail =
    doctorEmail.trim().toLowerCase();

  const newDateKey =
    this.getVisitDateKey(visitDate);

  return snapshot.docs
    .filter(d => {

      // Ignore the visit currently being edited
      if (
        excludeVisitId &&
        d.id === excludeVisitId
      ) {
        return false;
      }

      const data = d.data();

      const existingName =
        (data['doctorName'] || '')
          .trim()
          .toLowerCase();

      const existingEmail =
        (data['doctorEmail'] || '')
          .trim()
          .toLowerCase();

      const existingDateKey =
        this.getVisitDateKey(data['visitDate']);

      // Prefer email when available.
      // Fall back to doctor name when email isn't available.
      const sameDoctor =
        normalizedEmail && existingEmail
          ? normalizedEmail === existingEmail
          : normalizedName === existingName;

      const sameDate =
        newDateKey === existingDateKey;

      return sameDoctor && sameDate;
    })
    .map(d => ({
      id: d.id,
      status: d.data()['status'] ?? 'confirmed',
      ...d.data()
    })) as DoctorVisit[];
}

private getVisitDateKey(
  visitDate: any
): string {

  if (!visitDate) {
    return '';
  }

  // Normal ISO string:
  // 2026-09-15
  // 2026-09-15T08:30:00.000Z
  if (typeof visitDate === 'string') {
    return visitDate.substring(0, 10);
  }

  // Firestore Timestamp
  if (
    visitDate.toDate &&
    typeof visitDate.toDate === 'function'
  ) {
    const date = visitDate.toDate();

    return date.toISOString().substring(0, 10);
  }

  // Firestore timestamp object
  if (visitDate.seconds) {
    return new Date(
      visitDate.seconds * 1000
    ).toISOString().substring(0, 10);
  }

  return '';
}

}
