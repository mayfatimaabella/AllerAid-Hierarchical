import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase.config';

import {
  getFirestore
} from 'firebase/firestore';

import {
  getStorage
} from 'firebase/storage';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private db;
  private storage;

  constructor() {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    this.storage = getStorage(app);
  }

  // This service can be used for general Firebase operations
  // or removed if no longer needed since functionality is now
  // separated into AllergyService and BuddyService
  
  getDb() {
    return this.db;
  }

  getStorage() {
    return this.storage;
  }
}

