import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase.config';

import { getFirestore } from 'firebase/firestore';

import { getStorage } from 'firebase/storage';

import { getAuth } from 'firebase/auth';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private db;
  private storage;
  private auth;

  constructor() {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    this.storage = getStorage(app);
    this.auth = getAuth(app);
  }
  
  getDb() {
    return this.db;
  }

  getStorage() {
    return this.storage;
  }

  getAuth() {
  return this.auth;
}
}