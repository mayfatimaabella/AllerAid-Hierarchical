import { Injectable } from '@angular/core';
import {
  collection,
  addDoc,
  getDocs,
  setDoc,
  getDoc,
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
  categoryId?: string;
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

  // CREATE predefined allergy options (run once)
  async createAllergyOptions(): Promise<void> {
    try {
      const existingOptionsSnapshot = await getDocs(collection(this.db, 'allergyOptions'));

      if (existingOptionsSnapshot.size > 0) {
        console.log('Allergy options already exist, skipping creation');
        return;
      }

    const allergyOptions: AllergyOption[] = [

      // FOOD
      { name:'peanuts', label:'Peanuts', hasInput:false, order:1, isApproved:true, categoryId:'RDtNiC8y3cnbrkDpcC72' },
      { name:'dairy', label:'Dairy/Milk', hasInput:false, order:2, isApproved:true, categoryId:'RDtNiC8y3cnbrkDpcC72' },
      { name:'eggs', label:'Eggs', hasInput:false, order:3, isApproved:true, categoryId:'RDtNiC8y3cnbrkDpcC72' },
      { name:'wheat', label:'Wheat/Gluten', hasInput:false, order:4, isApproved:true, categoryId:'RDtNiC8y3cnbrkDpcC72' },
      { name:'fish', label:'Fish', hasInput:false, order:5, isApproved:true, categoryId:'RDtNiC8y3cnbrkDpcC72' },
      { name:'shellfish', label:'Shellfish', hasInput:false, order:6, isApproved:true, categoryId:'RDtNiC8y3cnbrkDpcC72' },
      { name:'soy', label:'Soy', hasInput:false, order:7, isApproved:true, categoryId:'RDtNiC8y3cnbrkDpcC72' },
      { name:'nuts', label:'Nuts', hasInput:false, order:14, isApproved:true, categoryId:'RDtNiC8y3cnbrkDpcC72' },

      // ENVIRONMENT
      { name:'pollen', label:'Pollen', hasInput:false, order:8, isApproved:true, categoryId:'a7r0dsJ3ruUx0oaKJurw' },

      // LATEX
      { name:'latex', label:'Latex', hasInput:false, order:9, isApproved:true, categoryId:'bEDsfeS5najHfUJA9DKX' },

      // PET
      { name:'animalDander', label:'Animal Dander', hasInput:false, order:10, isApproved:true, categoryId:'jYh2ac36XSEkqeaWU0Yf' },

      // INSECT
      { name:'insectStings', label:'Insect Stings', hasInput:false, order:11, isApproved:true, categoryId:'HPdf4gLvM9lmynqITbGC' },

      // MEDICATION
      { name:'medication', label:'Medication', hasInput:true, order:12, isApproved:true, categoryId:'9vzDVLy2xID2OFauZFgz' },

      // OTHER
      { name:'others', label:'Others', hasInput:true, order:13, isApproved:true, categoryId:'ftxLYiCRUoKirHOsle4Z' }
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

// GET all active/approved master allergy options
async getAllergyOptions(): Promise<any[]> {
  try {
    console.log('Reading allergyCategories...');

    
    // 1. Load allergy categories
    
    const categorySnapshot = await getDocs(
      collection(this.db, 'allergyCategories')
    );

    console.log(
      'Categories count:',
      categorySnapshot.size
    );

    const categoryMap = new Map<string, any>();

    categorySnapshot.docs.forEach(docSnap => {
      const category: any = {
        id: docSnap.id,
        ...docSnap.data()
      };

      console.log(
        'Category:',
        category.name,
        '| ID:',
        category.id,
        '| isActive:',
        category.isActive
      );

      /*
       * IMPORTANT:
       *
       * A category is considered active unless
       * isActive is explicitly false.
       *
       * This means old categories without an
       * active field will continue to work.
       */
      if (category.active !== false) {
        categoryMap.set(category.id, category);
      }
    });

    console.log(
      'Active categories:',
      Array.from(categoryMap.values())
    );

    
    // 2. Load allergy options
    
    console.log('Reading allergyOptions...');

    const optionsSnapshot = await getDocs(
      collection(this.db, 'allergyOptions')
    );

    console.log(
      'Options count:',
      optionsSnapshot.size
    );

    
    // 3. Filter and attach category information
    
    const options = optionsSnapshot.docs
      .map(docSnap => {
        const option: any = {
          id: docSnap.id,
          ...docSnap.data()
        };

        const category = categoryMap.get(
          option.categoryId
        );

        /*
         * If the option belongs to a category that:
         * - does not exist
         * - was deleted
         * - is disabled
         *
         * do NOT show the option.
         */
        if (!category) {
          console.log(
            'Skipping allergy option because category is inactive/missing:',
            option.label,
            '| categoryId:',
            option.categoryId
          );

          return null;
        }

        /*
         * If the individual allergy option has been
         * rejected/unapproved, don't show it either.
         */
        if (option.isApproved === false) {
          console.log(
            'Skipping unapproved allergy option:',
            option.label
          );

          return null;
        }

        return {
          ...option,

          // Category information used by onboarding
          categoryName: category.name,
          categoryOrder: category.order ?? 99
        };
      })
      .filter(
        (option): option is any =>
          option !== null
      );

    console.log(
      'FINAL ACTIVE ALLERGY OPTIONS:',
      options
    );

    return options;

  } catch (error) {
    console.error(
      'getAllergyOptions FAILED:',
      error
    );

    return [];
  }
}


  // RESET allergy options
  // async resetAllergyOptions(): Promise<void> { 
  //   const querySnapshot = await getDocs(collection(this.db, 'allergyOptions'));
  //   const deletePromises = querySnapshot.docs.map(docSnap =>
  //     deleteDoc(doc(this.db, 'allergyOptions', docSnap.id))
  //   );

  //   await Promise.all(deletePromises);
  //   await this.createAllergyOptions();
  // }

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

