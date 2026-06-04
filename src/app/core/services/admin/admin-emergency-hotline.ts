import { Injectable } from '@angular/core';
import { FirebaseService } from '../firebase.service';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  query
} from 'firebase/firestore';

export interface EmergencyHotline {
  id: string;
  name: string;
  number: string;
  isActive: boolean;
  defaultEnabled: boolean;
  order: number;
}

@Injectable({ providedIn: 'root' })
export class AdminEmergencyHotlineService {

  private firestore: Firestore;

  constructor(private firebase: FirebaseService) {
    this.firestore = this.firebase.getDb();
  }

  async getAllHotlines(): Promise<EmergencyHotline[]> {
    const ref = query(
      collection(this.firestore, 'emergency_hotlines'),
      orderBy('order', 'asc')
    );
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as EmergencyHotline));
  }

  async addHotline(data: Omit<EmergencyHotline, 'id'>): Promise<void> {
    await addDoc(collection(this.firestore, 'emergency_hotlines'), {
      ...data,
      createdAt: serverTimestamp()
    });
  }

  async updateHotline(id: string, data: Partial<Omit<EmergencyHotline, 'id'>>): Promise<void> {
    const ref = doc(this.firestore, `emergency_hotlines/${id}`);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  }

  async deleteHotline(id: string): Promise<void> {
    const ref = doc(this.firestore, `emergency_hotlines/${id}`);
    await deleteDoc(ref);
  }
}
