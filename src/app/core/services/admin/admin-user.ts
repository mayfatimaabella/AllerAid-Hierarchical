import { Injectable } from '@angular/core';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
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

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {

  private firestore = getFirestore();

  async getAllUsers(): Promise<AdminUser[]> {
    const usersRef = collection(this.firestore, 'users');
    const snapshot = await getDocs(usersRef);

    return snapshot.docs.map(docSnap => ({
      uid: docSnap.id,
      ...docSnap.data()
    } as AdminUser));
  }

  async activateUser(uid: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);

    await updateDoc(userRef, {
      isActive: true,
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
}