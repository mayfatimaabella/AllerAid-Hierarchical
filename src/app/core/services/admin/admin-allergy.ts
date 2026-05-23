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
  getDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';

@Injectable({ providedIn: 'root' })
export class AdminAllergyService {

  private firestore: Firestore;

  constructor(private firebase: FirebaseService) {
    this.firestore = firebase.getDb(); 
  }

  // =========================
  // ALLERGY OPTIONS
  // =========================

  async getAllAllergyOptions(): Promise<any[]> {
    const ref = collection(this.firestore, 'allergyOptions');
    const snapshot = await getDocs(ref);

    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  }

  async addAllergyOption(data: any): Promise<void> {
    const ref = collection(this.firestore, 'allergyOptions');

    await addDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async updateAllergyOption(id: string, data: any): Promise<void> {
    const ref = doc(this.firestore, `allergyOptions/${id}`);

    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteAllergyOption(id: string): Promise<void> {
    const ref = doc(this.firestore, `allergyOptions/${id}`);
    await deleteDoc(ref);
  }

  // =========================
  // ALLERGY SUGGESTIONS
  // =========================

  async getAllergySuggestions(): Promise<any[]> {
    const ref = collection(this.firestore, 'allergySuggestions');
    const q = query(ref, where('status', '==', 'pending'));
    const snapshot = await getDocs(q);

    const suggestions = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as any[];

    return suggestions.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }

async approveSuggestion(id: string, categoryId: string): Promise<void> {
  const suggestionRef = doc(this.firestore, `allergySuggestions/${id}`);
  const suggestionSnap = await getDoc(suggestionRef);

  if (!suggestionSnap.exists()) {
    throw new Error('Suggestion not found.');
  }

  if (!categoryId) {
    throw new Error('Category is required before approving suggestion.');
  }

  const suggestion = suggestionSnap.data();

  const rawName = (suggestion['name'] || suggestion['label'] || '').trim();

  if (!rawName) {
    throw new Error('Suggestion name is missing.');
  }

  const name = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');

  const label = (suggestion['label'] || rawName).trim();

  const optionsRef = collection(this.firestore, 'allergyOptions');

  const duplicateSnap = await getDocs(
    query(optionsRef, where('name', '==', name))
  );

  if (duplicateSnap.empty) {
    const allOptionsSnap = await getDocs(optionsRef);
    const nextOrder = allOptionsSnap.size + 1;

    await addDoc(optionsRef, {
      name,
      label,
      value: name,

    
      categoryId,

      hasInput: false,
      isCommon: false,
      order: nextOrder,
      isApproved: true,
      isActive: true,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(duplicateSnap.docs[0].ref, {
      categoryId,
      isApproved: true,
      isActive: true,
      updatedAt: serverTimestamp()
    });
  }

  await updateDoc(suggestionRef, {
    status: 'approved',
    categoryId,
    updatedAt: serverTimestamp()
  });
}

  async rejectSuggestion(id: string): Promise<void> {
    const ref = doc(this.firestore, `allergySuggestions/${id}`);

    await updateDoc(ref, {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
  }

  async getAllergyCategories(): Promise<any[]> {
    const ref = collection(this.firestore, 'allergyCategories');

    const q = query(
      ref,
      where('active', '==', true)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
      .map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      .sort((a: any, b: any) => {
        return (a.order || 0) - (b.order || 0);
      });
  }
}