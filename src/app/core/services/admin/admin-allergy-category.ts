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

export interface AllergyCategory {
  id: string;
  name: string;
  active: boolean;
  order: number;
}

@Injectable({ providedIn: 'root' })
export class AdminAllergyCategoryService {

  private firestore: Firestore;

  constructor(private firebase: FirebaseService) {
    this.firestore = firebase.getDb();
  }

  async getAllCategories(): Promise<AllergyCategory[]> {
    const ref = query(
      collection(this.firestore, 'allergyCategories'),
      orderBy('order', 'asc')
    );
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as AllergyCategory));
  }

  async addCategory(data: Omit<AllergyCategory, 'id'>): Promise<void> {
    await addDoc(collection(this.firestore, 'allergyCategories'), {
      ...data,
      createdAt: serverTimestamp()
    });
  }

  async updateCategory(id: string, data: Partial<Omit<AllergyCategory, 'id'>>): Promise<void> {
    const ref = doc(this.firestore, `allergyCategories/${id}`);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  }

  async deleteCategory(id: string): Promise<void> {
    const ref = doc(this.firestore, `allergyCategories/${id}`);
    await deleteDoc(ref);
  }
}
