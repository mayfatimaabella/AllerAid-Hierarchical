import { Injectable } from '@angular/core';


import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  getDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';

export interface AllergyOption {
  id?: string;
  name: string;
  label: string;
  hasInput: boolean;
  order: number;
  isApproved?: boolean;
}

export interface UserAllergy {
  name: string;
  label: string;
  checked: boolean;
  value?: string;
}

@Injectable({ providedIn: 'root' })
export class AllergyService {
  private db: Firestore;

  constructor(private firebase: FirebaseService) {
    this.db = this.firebase.getDb();
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
        { name: 'peanuts', label: 'Peanuts', hasInput: false, order: 1, isApproved: true },
        { name: 'dairy', label: 'Dairy/Milk', hasInput: false, order: 2, isApproved: true },
        { name: 'eggs', label: 'Eggs', hasInput: false, order: 3, isApproved: true },
        { name: 'wheat', label: 'Wheat/Gluten', hasInput: false, order: 4, isApproved: true },
        { name: 'fish', label: 'Fish', hasInput: false, order: 5, isApproved: true },
        { name: 'shellfish', label: 'Shellfish', hasInput: false, order: 6, isApproved: true },
        { name: 'soy', label: 'Soy', hasInput: false, order: 7, isApproved: true },
        { name: 'pollen', label: 'Pollen', hasInput: false, order: 8, isApproved: true },
        { name: 'latex', label: 'Latex', hasInput: false, order: 9, isApproved: true },
        { name: 'animalDander', label: 'Animal Dander', hasInput: false, order: 10, isApproved: true },
        { name: 'insectStings', label: 'Insect Stings', hasInput: false, order: 11, isApproved: true },
        { name: 'medication', label: 'Medication', hasInput: true, order: 12, isApproved: true },
        { name: 'others', label: 'Others', hasInput: true, order: 13, isApproved: true },
        { name: 'nuts', label: 'Nuts', hasInput: false, order: 14, isApproved: true }
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
async getAllergyOptions(): Promise<any[]> {
  try {
    console.log('Reading allergyCategories...');
    const categorySnapshot = await getDocs(
      collection(this.db, 'allergyCategories')
    );
    console.log('Categories count:', categorySnapshot.size);

    const categoryMap = new Map();

    categorySnapshot.docs.forEach(docSnap => {
      categoryMap.set(docSnap.id, {
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    console.log('Reading allergyOptions...');
    const optionsSnapshot = await getDocs(
      collection(this.db, 'allergyOptions')
    );
    console.log('Options count:', optionsSnapshot.size);

    let options = optionsSnapshot.docs.map(docSnap => {
      const option: any = {
        id: docSnap.id,
        ...docSnap.data()
      };

      const category: any = categoryMap.get(option.categoryId);

      return {
        ...option,
        categoryName: category?.name || 'Other',
        categoryOrder: category?.order || 99
      };
    });

    options = options.filter(opt => opt.isApproved !== false);

    return options;

  } catch (error) {
    console.error('getAllergyOptions FAILED:', error);
    return [];
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

async submitAllergySuggestion(suggestion: {
  name: string;
  label: string;
  categoryId: string;
  suggestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
}): Promise<void> {
  const suggestionsRef = collection(this.db, 'allergySuggestions');

  await addDoc(suggestionsRef, {
    ...suggestion,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
}

