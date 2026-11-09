import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

import { AdminUser } from './admin-user';

export interface DoctorVerificationRequest extends AdminUser {
  license?: string;
  specialty?: string;
  hospital?: string;
  licenseURL?: string;
  professionalCredentials?: any;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
}

@Injectable({
  providedIn: 'root'
})
export class AdminDoctorService {

  private firestore = getFirestore();

  async getDoctors(): Promise<AdminUser[]> {
    const usersRef = collection(this.firestore, 'users');

    const doctorQuery = query(
      usersRef,
      where('role', '==', 'doctor')
    );

    const snapshot = await getDocs(doctorQuery);

    return snapshot.docs.map(docSnap => ({
      uid: docSnap.id,
      ...docSnap.data()
    } as AdminUser));
  }

  async getPendingDoctorVerificationRequests(): Promise<DoctorVerificationRequest[]> {
    const doctors = await this.getDoctors();
    const pendingDoctors: DoctorVerificationRequest[] = [];

    for (const doctor of doctors) {
      const credentialsRef = doc(
        this.firestore,
        `users/${doctor.uid}/professional/credentials`
      );

      const credentialsSnap = await getDoc(credentialsRef);
      const credentials = credentialsSnap.exists() ? credentialsSnap.data() : null;

      const credentialStatus = this.normalizeVerificationStatus(
        credentials?.['verificationStatus']
      );
      const profileStatus = this.normalizeVerificationStatus(
        doctor.verificationStatus
      );
      const verificationStatus = credentialStatus ?? profileStatus ?? 'pending';

      if (verificationStatus === 'pending') {
        pendingDoctors.push({
          ...doctor,
          verificationStatus,
          license: credentials?.['license'],
          specialty: credentials?.['specialty'],
          hospital: credentials?.['hospital'],
          licenseURL: credentials?.['licenseURL'],
          professionalCredentials: credentials
        });
      }
    }

    return pendingDoctors;
  }

  async approveDoctor(uid: string): Promise<void> {
    const credentialsRef = doc(
      this.firestore,
      `users/${uid}/professional/credentials`
    );

    await setDoc(credentialsRef, {
      verificationStatus: 'approved',
      verifiedAt: serverTimestamp()
    }, { merge: true });

    const userRef = doc(this.firestore, `users/${uid}`);

    await updateDoc(userRef, {
      verificationStatus: 'approved',
      isActive: true,
      updatedAt: serverTimestamp()
    });
  }

  async rejectDoctor(uid: string, reason?: string): Promise<void> {
    const credentialsRef = doc(
      this.firestore,
      `users/${uid}/professional/credentials`
    );

    await setDoc(credentialsRef, {
      verificationStatus: 'rejected',
      rejectionReason: reason || '',
      rejectedAt: serverTimestamp()
    }, { merge: true });

    const userRef = doc(this.firestore, `users/${uid}`);

    await updateDoc(userRef, {
      verificationStatus: 'rejected',
      updatedAt: serverTimestamp()
    });
  }

  private normalizeVerificationStatus(
    status: unknown
  ): 'pending' | 'approved' | 'rejected' | undefined {
    if (typeof status !== 'string') {
      return undefined;
    }

    const normalizedStatus = status.trim().toLowerCase();
    return normalizedStatus === 'pending' ||
      normalizedStatus === 'approved' ||
      normalizedStatus === 'rejected'
      ? normalizedStatus
      : undefined;
  }
}