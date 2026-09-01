import { Injectable } from '@angular/core';

import {
  getApps,
  getApp,
  initializeApp,
  FirebaseApp
} from 'firebase/app';

import { firebaseConfig } from './firebase.config';

import {
  getFirestore,
  Firestore
} from 'firebase/firestore';

import {
  getStorage,
  FirebaseStorage
} from 'firebase/storage';

import {
  Auth,
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence
} from 'firebase/auth';

//Firebase App
const app: FirebaseApp =
  getApps().length
    ? getApp()
    : initializeApp(firebaseConfig);


//FirebaseAuth

let auth: Auth;

try {

  auth = initializeAuth(app, {
    persistence: indexedDBLocalPersistence
  });

} catch {

  /*
   * Auth may already have been initialized.
   * In that case, get the existing Auth instance.
   */

  auth = getAuth(app);

}


//Firebase Service

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {

  private db: Firestore =
    getFirestore(app);


  private storage: FirebaseStorage =
    getStorage(app);


  private auth: Auth =
    auth;


//Firestore 

  getDb(): Firestore {

    return this.db;

  }


//Storage

  getStorage(): FirebaseStorage {

    return this.storage;

  }


//Auth

  getAuth(): Auth {

    return this.auth;

  }


//Firebase Config

  getFirebaseConfig() {

    return firebaseConfig;

  }

}