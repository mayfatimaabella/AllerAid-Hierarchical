import { Injectable } from '@angular/core';

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  query,
  orderBy,
  where
} from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class AdminAllergyService {

  private firestore = getFirestore();

  // =========================
  // ALLERGY OPTIONS
  // =========================

  async getAllAllergyOptions(): Promise<any[]> {

    const ref =
      collection(this.firestore, 'allergyOptions');

    const snapshot = await getDocs(ref);

    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
  }

  async addAllergyOption(data: any): Promise<void> {

    const ref =
      collection(this.firestore, 'allergyOptions');

    await addDoc(ref, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async updateAllergyOption(
    id: string,
    data: any
  ): Promise<void> {

    const ref =
      doc(this.firestore, `allergyOptions/${id}`);

    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteAllergyOption(id: string): Promise<void> {

    const ref =
      doc(this.firestore, `allergyOptions/${id}`);

    await deleteDoc(ref);
  }

  // =========================
  // ALLERGY SUGGESTIONS
  // =========================

  async getAllergySuggestions(): Promise<any[]> {

    const ref =
      collection(this.firestore, 'allergySuggestions');

    const q = query(
      ref,
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);

    const suggestions = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as any[];

    // Sort by createdAt in TypeScript instead of Firestore
    return suggestions.sort((a, b) => {
      const aTime = (a as any).createdAt?.toMillis?.() || 0;
      const bTime = (b as any).createdAt?.toMillis?.() || 0;
      return bTime - aTime; // descending order
    });
  }

async approveSuggestion(id: string): Promise<void> {
  const suggestionRef = doc(this.firestore, `allergySuggestions/${id}`);
  const suggestionSnap = await getDoc(suggestionRef);

  if (!suggestionSnap.exists()) {
    throw new Error('Suggestion not found.');
  }

  const suggestion = suggestionSnap.data();

  const name = suggestion['name'];
  const label = suggestion['label'] || suggestion['name'];
  const category = suggestion['category'] || 'General';

  const optionsRef = collection(this.firestore, 'allergyOptions');

  const duplicateQuery = query(
    optionsRef,
    where('name', '==', name)
  );

  const duplicateSnap = await getDocs(duplicateQuery);

  if (duplicateSnap.empty) {
    const optionsSnap = await getDocs(
      query(optionsRef, orderBy('order'))
    );

    const nextOrder = optionsSnap.size + 1;

    await addDoc(optionsRef, {
      name,
      label,
      value: name,
      category,
      hasInput: false,
      order: nextOrder,
      isApproved: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await updateDoc(suggestionRef, {
    status: 'approved',
    updatedAt: serverTimestamp()
  });
}

  async rejectSuggestion(id: string): Promise<void> {

    const ref =
      doc(this.firestore, `allergySuggestions/${id}`);

    await updateDoc(ref, {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
  }
}