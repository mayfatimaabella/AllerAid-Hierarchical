import { Injectable } from '@angular/core';
import { FirebaseService } from '../firebase.service';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
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
  dateCreated?: any;
  lastLogin?: any;
  phone?: string;
  allergies?: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminUserService {

  private firestore: Firestore;

  constructor(private firebase: FirebaseService) {
    this.firestore = this.firebase.getDb();
  }

  async getAllUsers(): Promise<AdminUser[]> {
    const usersRef = collection(this.firestore, 'users');
    const snapshot = await getDocs(usersRef);
    return snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as AdminUser));
  }

  async createUser(data: Omit<AdminUser, 'uid'>): Promise<void> {
    const usersRef = collection(this.firestore, 'users');
    const newRef = doc(usersRef); // auto-generated ID
    await setDoc(newRef, {
      ...data,
      isActive: true,
      dateCreated: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async updateUser(uid: string, data: Partial<AdminUser>): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    await updateDoc(userRef, { ...data, updatedAt: serverTimestamp() });
  }

  async activateUser(uid: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    await updateDoc(userRef, { isActive: true, updatedAt: serverTimestamp() });
  }

  async deactivateUser(uid: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    await updateDoc(userRef, { isActive: false, updatedAt: serverTimestamp() });
  }

  async deleteUser(uid: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    await deleteDoc(userRef);
  }
}