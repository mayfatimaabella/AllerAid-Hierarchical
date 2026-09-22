import { Injectable } from '@angular/core';
import { getApps, getApp, initializeApp,FirebaseApp} from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { Auth, getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';

import { firebaseConfig } from './firebase.config';



// FIREBASE APP


const app: FirebaseApp =
  getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);



// FIREBASE AUTH


let auth: Auth;

try {

  auth = initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence
    ]
  });

  console.log(
    'Firebase Auth: persistent authentication enabled'
  );

} catch (error) {

  // Auth was already initialized.
  // This can happen during development/hot reload.

  console.log(
    'Firebase Auth already initialized'
  );

  auth = getAuth(app);
}

// FIRESTORE

const db: Firestore =
  getFirestore(app);

// STORAGE

const storage: FirebaseStorage =
  getStorage(app);

// FIREBASE SERVICE


@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  private db: Firestore = db;

  private storage: FirebaseStorage = storage;

  private auth: Auth = auth;


  
  // FIRESTORE
  

  getDb(): Firestore {
    return this.db;
  }


  
  // STORAGE
  

  getStorage(): FirebaseStorage {
    return this.storage;
  }


  
  // AUTH
  

  getAuth(): Auth {
    return this.auth;
  }


  
  // FIREBASE CONFIG
  

  getFirebaseConfig() {
    return firebaseConfig;
  }

}
