import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

export interface AdminUser {
  uid: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  role?: 'user' | 'doctor' | 'admin';
  isActive?: boolean;
  verificationStatus?: string;
  createdAt?: any;
  lastLogin?: any;
}

export interface DoctorVerificationRequest extends AdminUser {
  license?: string;
  specialty?: string;
  hospital?: string;
  licenseURL?: string;
  professionalCredentials?: any;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  private firestore = getFirestore();

  async getAllUsers(): Promise<AdminUser[]> {
    const usersRef = collection(this.firestore, 'users');
    const snapshot = await getDocs(usersRef);

    return snapshot.docs.map(docSnap => ({
      uid: docSnap.id,
      ...docSnap.data()
    } as AdminUser));
  }

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

      const verificationStatus =
        credentials?.['verificationStatus'] ||
        doctor.verificationStatus ||
        'pending';

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

    await updateDoc(credentialsRef, {
      verificationStatus: 'approved',
      verifiedAt: serverTimestamp()
    });

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

    await updateDoc(credentialsRef, {
      verificationStatus: 'rejected',
      rejectionReason: reason || '',
      rejectedAt: serverTimestamp()
    });

    const userRef = doc(this.firestore, `users/${uid}`);

    await updateDoc(userRef, {
      verificationStatus: 'rejected',
      updatedAt: serverTimestamp()
    });
  }

  async deactivateUser(uid: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);

    await updateDoc(userRef, {
      isActive: false,
      updatedAt: serverTimestamp()
    });
  }

  async activateUser(uid: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);

    await updateDoc(userRef, {
      isActive: true,
      updatedAt: serverTimestamp()
    });
  }
}