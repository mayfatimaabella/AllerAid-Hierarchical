import { Injectable } from '@angular/core';
import { getApps, getApp, initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase.config';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import {
  Auth,
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence
} from 'firebase/auth';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// initializeAuth once with persistence — falls back to getAuth()
// if auth was already initialized (e.g. during hot reload)
let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
} catch {
  auth = getAuth(app);
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private db: Firestore = getFirestore(app);
  private storage: FirebaseStorage = getStorage(app);
  private auth: Auth = auth;

  getDb(): Firestore {
    return this.db;
  }

  getStorage(): FirebaseStorage {
    return this.storage;
  }

  getAuth(): Auth {
    return this.auth;
  }
}