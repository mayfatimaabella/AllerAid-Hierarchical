import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { FirebaseService } from './firebase.service';

import {
  Auth,
  User,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private auth: Auth;

  // null = not logged in
  // User = logged in
  private currentUserSubject = new BehaviorSubject<User | null>(null);

  constructor(private firebase: FirebaseService) {
    this.auth = firebase.getAuth();

    onAuthStateChanged(this.auth, (user) => {
      console.log(
        '[Auth] Auth state changed:',
        user?.email ?? 'No user'
      );

      this.currentUserSubject.next(user);
    });
  }


  // CURRENT USER


  getCurrentUser$(): Observable<User | null> {
    return this.currentUserSubject.asObservable();
  }

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  getCurrentUserEmail(): string | null {
    return this.auth.currentUser?.email ?? null;
  }


  // AUTH INITIALIZATION


  async waitForAuthInit(): Promise<User | null> {
    console.log('[Auth] Waiting for authentication...');

    await this.auth.authStateReady();

    const user = this.auth.currentUser;

    console.log(
      '[Auth] Authentication restored:',
      user?.email ?? 'No user'
    );

    return user;
  }

  // SIGN IN / SIGN UP

  async signIn(email: string, password: string) {
    return signInWithEmailAndPassword(
      this.auth,
      email,
      password
    );
  }

  async signUp(email: string, password: string) {
    return createUserWithEmailAndPassword(
      this.auth,
      email,
      password
    );
  }

  // EMAIL VERIFICATION

  async sendVerificationEmail(user?: User): Promise<void> {
    const targetUser = user ?? this.auth.currentUser;

    if (!targetUser) {
      throw new Error('No user is currently logged in.');
    }

    await sendEmailVerification(targetUser);
  }

  async resendVerificationEmail(): Promise<void> {
    await this.sendVerificationEmail();
  }


  // SIGN OUT


  async signOut(): Promise<void> {
    await signOut(this.auth);
  }


  // PASSWORD


  async reauthenticateUser(password: string): Promise<void> {
    const user = this.auth.currentUser;

    if (!user?.email) {
      throw new Error('No user is currently logged in.');
    }

    const credential = EmailAuthProvider.credential(
      user.email,
      password
    );

    await reauthenticateWithCredential(
      user,
      credential
    );
  }

  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {

    await this.reauthenticateUser(currentPassword);

    const user = this.auth.currentUser;

    if (!user) {
      throw new Error('No user is currently logged in.');
    }

    await updatePassword(user, newPassword);
  }

  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(
      this.auth,
      email
    );
  }
}