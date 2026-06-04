import { Injectable } from '@angular/core';
import { FirebaseService } from '../firebase.service';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class AdminEmergencyService {

  private firestore: Firestore;

  constructor(private firebase: FirebaseService) {
    this.firestore = this.firebase.getDb();
  }

  async getAllEmergencies(): Promise<any[]> {
    const emergenciesRef = collection(this.firestore, 'emergencies');
    const snapshot = await getDocs(emergenciesRef);

    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  }

  async getEmergencyById(id: string): Promise<any | null> {
    const emergencyRef = doc(this.firestore, `emergencies/${id}`);
    const snapshot = await getDoc(emergencyRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data()
    };
  }

  async updateEmergencyStatus(
    emergencyId: string,
    status: 'active' | 'responding' | 'resolved' | 'archived',
    adminUid: string 
  ): Promise<void> {
    const emergencyRef = doc(this.firestore, `emergencies/${emergencyId}`);

    await updateDoc(emergencyRef, {
      status,
      updatedAt: serverTimestamp()
    });
  }
}