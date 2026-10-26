import { Injectable } from '@angular/core';

import {
  Firestore,
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
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

export interface AllergyOptionWithCategory extends AllergyOption {
  categoryName: string;
  categoryOrder: number;
}

export interface AllergySuggestion {
  name: string;
  label: string;
  categoryId: string;
  suggestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
}

@Injectable({
  providedIn: 'root',
})
export class AllergyService {

  private db: Firestore;

  constructor(private firebase: FirebaseService) {
    this.db = this.firebase.getDb();
  }


  // FIRESTORE REFERENCES


  private allergyOptionsRef() {
    return collection(this.db, 'allergyOptions');
  }

  private allergyCategoriesRef() {
    return collection(this.db, 'allergyCategories');
  }

  private allergySuggestionsRef() {
    return collection(this.db, 'allergySuggestions');
  }

  private medicalInfoRef(userId: string) {
    return doc(
      this.db,
      'users',
      userId,
      'medical',
      'info'
    );
  }


  // USER ALLERGIES


  async saveUserAllergies(
    userId: string,
    allergies: UserAllergy[]
  ): Promise<void> {

    await setDoc(
      this.medicalInfoRef(userId),
      {
        allergies,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async getUserAllergies(
    userId: string
  ): Promise<UserAllergy[]> {

    const snapshot = await getDoc(
      this.medicalInfoRef(userId)
    );

    if (!snapshot.exists()) {
      return [];
    }

    const data = snapshot.data();

    return (data['allergies'] as UserAllergy[]) ?? [];
  }


  // CREATE DEFAULT ALLERGY OPTIONS


  async createAllergyOptions(): Promise<void> {
    try {
      const snapshot = await getDocs(
        this.allergyOptionsRef()
      );

      if (!snapshot.empty) {
        console.log(
          '[Allergy] Options already exist. Skipping creation.'
        );
        return;
      }

      const allergyOptions: AllergyOption[] = [

        // FOOD
        {
          name: 'peanuts',
          label: 'Peanuts',
          hasInput: false,
          order: 1,
          isApproved: true,
          categoryId: 'RDtNiC8y3cnbrkDpcC72',
        },
        {
          name: 'dairy',
          label: 'Dairy/Milk',
          hasInput: false,
          order: 2,
          isApproved: true,
          categoryId: 'RDtNiC8y3cnbrkDpcC72',
        },
        {
          name: 'eggs',
          label: 'Eggs',
          hasInput: false,
          order: 3,
          isApproved: true,
          categoryId: 'RDtNiC8y3cnbrkDpcC72',
        },
        {
          name: 'wheat',
          label: 'Wheat/Gluten',
          hasInput: false,
          order: 4,
          isApproved: true,
          categoryId: 'RDtNiC8y3cnbrkDpcC72',
        },
        {
          name: 'fish',
          label: 'Fish',
          hasInput: false,
          order: 5,
          isApproved: true,
          categoryId: 'RDtNiC8y3cnbrkDpcC72',
        },
        {
          name: 'shellfish',
          label: 'Shellfish',
          hasInput: false,
          order: 6,
          isApproved: true,
          categoryId: 'RDtNiC8y3cnbrkDpcC72',
        },
        {
          name: 'soy',
          label: 'Soy',
          hasInput: false,
          order: 7,
          isApproved: true,
          categoryId: 'RDtNiC8y3cnbrkDpcC72',
        },
        {
          name: 'nuts',
          label: 'Nuts',
          hasInput: false,
          order: 14,
          isApproved: true,
          categoryId: 'RDtNiC8y3cnbrkDpcC72',
        },

        // ENVIRONMENT
        {
          name: 'pollen',
          label: 'Pollen',
          hasInput: false,
          order: 8,
          isApproved: true,
          categoryId: 'a7r0dsJ3ruUx0oaKJurw',
        },

        // LATEX
        {
          name: 'latex',
          label: 'Latex',
          hasInput: false,
          order: 9,
          isApproved: true,
          categoryId: 'bEDsfeS5najHfUJA9DKX',
        },

        // PET
        {
          name: 'animalDander',
          label: 'Animal Dander',
          hasInput: false,
          order: 10,
          isApproved: true,
          categoryId: 'jYh2ac36XSEkqeaWU0Yf',
        },

        // INSECT
        {
          name: 'insectStings',
          label: 'Insect Stings',
          hasInput: false,
          order: 11,
          isApproved: true,
          categoryId: 'HPdf4gLvM9lmynqITbGC',
        },

        // MEDICATION
        {
          name: 'medication',
          label: 'Medication',
          hasInput: true,
          order: 12,
          isApproved: true,
          categoryId: '9vzDVLy2xID2OFauZFgz',
        },

        // OTHER
        {
          name: 'others',
          label: 'Others',
          hasInput: true,
          order: 13,
          isApproved: true,
          categoryId: 'ftxLYiCRUoKirHOsle4Z',
        },
      ];

      await Promise.all(
        allergyOptions.map(option =>
          addDoc(
            this.allergyOptionsRef(),
            option
          )
        )
      );

      console.log(
        '[Allergy] Default options created successfully.'
      );

    } catch (error) {
      console.error(
        '[Allergy] Failed to create options:',
        error
      );

      throw error;
    }
  }


  // GET ACTIVE ALLERGY OPTIONS


  async getAllergyOptions(): Promise<AllergyOptionWithCategory[]> {
    try {
      // Get categories
      const categorySnapshot = await getDocs(
        this.allergyCategoriesRef()
      );

      const categoryMap = new Map<
        string,
        {
          id: string;
          name: string;
          order?: number;
          isActive?: boolean;
          active?: boolean;
        }
      >();

      categorySnapshot.docs.forEach(categoryDoc => {
        const data = categoryDoc.data();

        /*
         * Category is active unless explicitly disabled.
         *
         * Supports both:
         * - isActive
         * - active
         *
         * Older documents may not have either field.
         */
        const isActive =
          data['isActive'] !== false &&
          data['active'] !== false;

        if (!isActive) {
          return;
        }

        categoryMap.set(categoryDoc.id, {
          id: categoryDoc.id,
          name: data['name'] ?? '',
          order: data['order'],
          isActive: data['isActive'],
          active: data['active'],
        });
      });

      // Get allergy options
      const optionsSnapshot = await getDocs(
        this.allergyOptionsRef()
      );

      return optionsSnapshot.docs
        .map(optionDoc => {

          const data = optionDoc.data();

          const option: AllergyOption = {
            id: optionDoc.id,
            name: data['name'] ?? '',
            label: data['label'] ?? '',
            hasInput: data['hasInput'] ?? false,
            order: data['order'] ?? 0,
            isApproved: data['isApproved'],
            categoryId: data['categoryId'],
          };

          const category = option.categoryId
            ? categoryMap.get(option.categoryId)
            : undefined;

          // Skip missing/inactive categories
          if (!category) {
            return null;
          }

          // Skip unapproved options
          if (option.isApproved === false) {
            return null;
          }

          return {
            ...option,
            categoryName: category.name,
            categoryOrder: category.order ?? 99,
          };
        })
        .filter(
          (
            option
          ): option is AllergyOptionWithCategory =>
            option !== null
        );

    } catch (error) {
      console.error(
        '[Allergy] Failed to load allergy options:',
        error
      );

      return [];
    }
  }

  // ALLERGY SUGGESTIONS


  async submitAllergySuggestion(
    suggestion: AllergySuggestion
  ): Promise<void> {

    await addDoc(
      this.allergySuggestionsRef(),
      {
        ...suggestion,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
  }
}
