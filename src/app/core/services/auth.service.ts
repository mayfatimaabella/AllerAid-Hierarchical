import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
  onAuthStateChanged,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  indexedDBLocalPersistence
} from 'firebase/auth';
import { firebaseConfig } from './firebase.config';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private authInitialized = false;

  constructor() {
    const app = initializeApp(firebaseConfig);

    this.auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence
    });

    onAuthStateChanged(this.auth, (user) => {
      console.log('Auth state changed:', user?.email || 'No user');
      this.currentUserSubject.next(user);
      this.authInitialized = true;
    });
  }

  getCurrentUser$(): Observable<User | null> {
    return this.currentUserSubject.asObservable();
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  getCurrentUserEmail(): string | null {
    return this.auth.currentUser?.email ?? null;
  }

  isAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  async waitForAuthInit(): Promise<User | null> {
    return new Promise((resolve) => {
      if (this.authInitialized) {
        resolve(this.auth.currentUser);
        return;
      }

      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  async resendVerificationEmail() {
    await this.sendVerificationEmail();
  }

  async signIn(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);

    if (!userCredential.user.emailVerified) {
      throw {
        code: 'auth/email-not-verified',
        message: 'Please verify your email address before logging in.'
      };
    }

    return userCredential;
  }

  async signUp(email: string, password: string) {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    return userCredential;
  }

  async sendVerificationEmail(user?: User): Promise<void> {
    const targetUser = user ?? this.auth.currentUser;
    if (!targetUser) {
      throw new Error('No user is currently logged in.');
    }

    await sendEmailVerification(targetUser);
  }

  async signOut() {
    await signOut(this.auth);
    this.currentUserSubject.next(null);
  }

  async reauthenticateUser(password: string): Promise<void> {
    const user = this.auth.currentUser;

    if (!user || !user.email) {
      throw new Error('No user is currently logged in.');
    }

    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.reauthenticateUser(currentPassword);

    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('No user is currently logged in.');
    }

    await updatePassword(user, newPassword);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  getAuth(): Auth {
    return this.auth;
  }
}

