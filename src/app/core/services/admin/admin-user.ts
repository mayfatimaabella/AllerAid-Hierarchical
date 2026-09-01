import { Injectable } from '@angular/core';

import { FirebaseService } from '../firebase.service';

import {
  Firestore,
  collection,
  doc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';

import {
  Auth,
  getAuth,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';

import {
  FirebaseApp,
  initializeApp,
  deleteApp
} from 'firebase/app';




export interface AdminUser {

  uid: string;

  email?: string;

  firstName?: string;

  lastName?: string;

  fullName?: string;

  role?: 'user' | 'doctor' | 'admin';

  isActive?: boolean;

  dateCreated?: any;

  lastLogin?: any;

  phone?: string;

  allergies?: string[];
}


export interface CreateAdminUserData {

  email: string;

  password: string;

  firstName: string;

  lastName?: string;

  fullName?: string;

  phone?: string;

  role?: 'user' | 'doctor' | 'admin';

}


@Injectable({
  providedIn: 'root'
})
export class AdminUserService {

  private firestore: Firestore;

  constructor(
    private firebase: FirebaseService
  ) {

    this.firestore = this.firebase.getDb();

  }


  // 
  // GET ALL USERS
  // 

  async getAllUsers(): Promise<AdminUser[]> {

    const usersRef = collection(
      this.firestore,
      'users'
    );

    const snapshot = await getDocs(usersRef);

    return snapshot.docs.map(d => ({
      uid: d.id,
      ...d.data()
    } as AdminUser));

  }


  // 
  // CREATE USER
  // 

  async createUser(
    data: CreateAdminUserData
  ): Promise<AdminUser> {

    const email = data.email.trim().toLowerCase();

    const password = data.password.trim();


    if (!email) {
      throw new Error('Email is required.');
    }


    if (!password) {
      throw new Error('Password is required.');
    }


    if (password.length < 6) {
      throw new Error(
        'Password must be at least 6 characters.'
      );
    }


    let temporaryApp: FirebaseApp | null = null;


    try {

      /*
       * IMPORTANT:
       *
       * We use a SECOND Firebase app/Auth instance.
       *
       * This prevents createUserWithEmailAndPassword()
       * from logging the administrator out.
       */

      const firebaseConfig =
        this.firebase.getFirebaseConfig();


      temporaryApp = initializeApp(
        firebaseConfig,
        `admin-create-user-${Date.now()}`
      );


      const secondaryAuth: Auth =
        getAuth(temporaryApp);


      // 
      // CREATE FIREBASE AUTH ACCOUNT
      // 

      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );


      const uid = credential.user.uid;


      // 
      // CREATE FIRESTORE PROFILE
      // 

      const userRef = doc(
        this.firestore,
        'users',
        uid
      );


      const userData = {

        uid,

        email,

        firstName: data.firstName.trim(),

        lastName: data.lastName?.trim() || '',

        fullName:
          data.fullName?.trim() ||
          `${data.firstName} ${data.lastName || ''}`.trim(),

        phone: data.phone?.trim() || '',

        role: data.role || 'user',

        isActive: true,

        dateCreated: serverTimestamp(),

        updatedAt: serverTimestamp(),

        /*
         * This is NOT the password.
         *
         * It only indicates that the account was
         * created by an administrator.
         */

        accountCreatedByAdmin: true

      };


      await setDoc(
        userRef,
        userData
      );


      /*
       * Sign out the temporary Auth instance.
       *
       * This does NOT sign out the administrator's
       * main Firebase Auth session.
       */

      await signOut(secondaryAuth);

    return userData as AdminUser;

    } catch (error: any) {

      console.error(
        'Create admin user error:',
        error
      );


      // 
      // FRIENDLY FIREBASE AUTH ERRORS
      // 

      if (
        error?.code ===
        'auth/email-already-in-use'
      ) {

        throw new Error(
          'This email address is already registered.'
        );

      }


      if (
        error?.code ===
        'auth/invalid-email'
      ) {

        throw new Error(
          'Please enter a valid email address.'
        );

      }


      if (
        error?.code ===
        'auth/weak-password'
      ) {

        throw new Error(
          'Password must be at least 6 characters.'
        );

      }


      throw error;


    } finally {

      /*
       * Remove the temporary Firebase app.
       */

      if (temporaryApp) {

        try {

          await deleteApp(
            temporaryApp
          );

        } catch (cleanupError) {

          console.warn(
            'Temporary Firebase app cleanup failed:',
            cleanupError
          );

        }

      }

    }

  }


  // 
  // UPDATE USER
  // 

  async updateUser(
    uid: string,
    data: Partial<AdminUser>
  ): Promise<void> {

    const userRef = doc(
      this.firestore,
      `users/${uid}`
    );


    /*
     * Don't allow the UID to be changed
     * through the admin edit form.
     */

    const {
      uid: ignoredUid,
      ...updateData
    } = data;


    await updateDoc(
      userRef,
      {
        ...updateData,
        updatedAt: serverTimestamp()
      }
    );

  }


  // 
  // ACTIVATE USER
  // 

  async activateUser(
    uid: string
  ): Promise<void> {

    const userRef = doc(
      this.firestore,
      `users/${uid}`
    );


    await updateDoc(
      userRef,
      {
        isActive: true,
        updatedAt: serverTimestamp()
      }
    );

  }



  // DEACTIVATE USER

  async deactivateUser(
    uid: string
  ): Promise<void> {

    const userRef = doc(
      this.firestore,
      `users/${uid}`
    );


    await updateDoc(
      userRef,
      {
        isActive: false,
        updatedAt: serverTimestamp()
      }
    );

  }

  // DELETE USER


  async deleteUser(
    uid: string
  ): Promise<void> {

    const userRef = doc(
      this.firestore,
      `users/${uid}`
    );


    /*
     * This deletes the Firestore profile.
     *
     * Deleting another user's Firebase Authentication
     * account cannot safely be done from the browser
     * using the normal Firebase Auth client SDK.
     *
     * For now, we delete the Firestore profile.
     */

    await deleteDoc(userRef);

  }

}