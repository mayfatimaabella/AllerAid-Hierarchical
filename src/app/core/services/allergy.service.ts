import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase.config';

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';

export interface AllergyOption {
  id?: string;
  name: string;
  label: string;
  hasInput: boolean;
  order: number;
}

export interface UserAllergy {
  name: string;
  label: string;
  checked: boolean;
  value?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AllergyService {
  private db;

  constructor() {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  // reference to users/{uid}/medical/info
  private medicalInfoRef(userId: string) {
    return doc(this.db, 'users', userId, 'medical', 'info');
  }

  // SAVE or CREATE user allergies in hierarchical structure
  async saveUserAllergies(userId: string, allergies: UserAllergy[]): Promise<void> {
    const medicalRef = this.medicalInfoRef(userId);

    await setDoc(
      medicalRef,
      {
        allergies,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  // GET user allergies
  async getUserAllergies(userId: string): Promise<UserAllergy[]> {
    const medicalRef = this.medicalInfoRef(userId);
    const snapshot = await getDoc(medicalRef);

    if (!snapshot.exists()) {
      return [];
    }

    const data = snapshot.data();
    return data?.['allergies'] || [];
  }

  // UPDATE user allergies
  async updateUserAllergies(userId: string, allergies: UserAllergy[]): Promise<void> {
    const medicalRef = this.medicalInfoRef(userId);

    await setDoc(
      medicalRef,
      {
        allergies,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  // CLEAR user allergies
  async clearUserAllergies(userId: string): Promise<void> {
    const medicalRef = this.medicalInfoRef(userId);

    await setDoc(
      medicalRef,
      {
        allergies: [],
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }

  // CHECK if user has a specific allergy
  async userHasAllergy(userId: string, allergyName: string): Promise<boolean> {
    const allergies = await this.getUserAllergies(userId);
    return allergies.some(a => a.name === allergyName && a.checked);
  }

  // GET checked allergy labels only
  async getUserAllergyList(userId: string): Promise<string[]> {
    const allergies = await this.getUserAllergies(userId);
    return allergies
      .filter(a => a.checked)
      .map(a => a.value?.trim() ? `${a.label}: ${a.value}` : a.label);
  }

  // CREATE predefined allergy options (run once)
  async createAllergyOptions(): Promise<void> {
    try {
      const existingOptionsSnapshot = await getDocs(collection(this.db, 'allergyOptions'));

      if (existingOptionsSnapshot.size > 0) {
        console.log('Allergy options already exist, skipping creation');
        return;
      }

      const allergyOptions: AllergyOption[] = [
        { name: 'peanuts', label: 'Peanuts/Nuts', hasInput: false, order: 1 },
        { name: 'dairy', label: 'Dairy/Milk', hasInput: false, order: 2 },
        { name: 'eggs', label: 'Eggs', hasInput: false, order: 3 },
        { name: 'wheat', label: 'Wheat/Gluten', hasInput: false, order: 4 },
        { name: 'fish', label: 'Fish', hasInput: false, order: 5 },
        { name: 'shellfish', label: 'Shellfish', hasInput: false, order: 6 },
        { name: 'soy', label: 'Soy', hasInput: false, order: 7 },
        { name: 'pollen', label: 'Pollen', hasInput: false, order: 8 },
        { name: 'latex', label: 'Latex', hasInput: false, order: 9 },
        { name: 'animalDander', label: 'Animal Dander', hasInput: false, order: 10 },
        { name: 'insectStings', label: 'Insect Stings', hasInput: false, order: 11 },
        { name: 'medication', label: 'Medication', hasInput: true, order: 12 },
        { name: 'others', label: 'Others', hasInput: true, order: 13 }
      ];

      for (const option of allergyOptions) {
        await addDoc(collection(this.db, 'allergyOptions'), option);
      }

      console.log('Allergy options created successfully');
    } catch (error) {
      console.error('Error creating allergy options:', error);
      throw error;
    }
  }

  // GET all master allergy options
  async getAllergyOptions(): Promise<AllergyOption[]> {
    try {
      const { query, orderBy } = await import('firebase/firestore');
      const allergyOptionsRef = collection(this.db, 'allergyOptions');
      const q = query(allergyOptionsRef, orderBy('order'));
      const querySnapshot = await getDocs(q);

      const options = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as AllergyOption[];

      const uniqueByName: Record<string, AllergyOption> = {};
      options.forEach(option => {
        const name = option.name;
        if (!uniqueByName[name]) {
          uniqueByName[name] = option;
        }
      });

      return Object.values(uniqueByName).sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error('Error fetching allergy options:', error);
      throw error;
    }
  }

  // RESET allergy options
  async resetAllergyOptions(): Promise<void> {
    const querySnapshot = await getDocs(collection(this.db, 'allergyOptions'));
    const deletePromises = querySnapshot.docs.map(docSnap =>
      deleteDoc(doc(this.db, 'allergyOptions', docSnap.id))
    );

    await Promise.all(deletePromises);
    await this.createAllergyOptions();
  }
}

