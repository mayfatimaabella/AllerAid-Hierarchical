import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, RegistrationError } from '@capacitor/push-notifications';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, arrayUnion } from 'firebase/firestore';
import { firebaseConfig } from './firebase.config';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private db = getFirestore(getApps().length ? getApps()[0] : initializeApp(firebaseConfig));
  private initialized = false;

  constructor(private authService: AuthService) {}

  /**
   * Call once on app startup (after auth init) to register for push
   * and persist the current device token in Firestore for this user.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Only register push on native platforms
    if (Capacitor.getPlatform() === 'web') {
      console.log('PushNotificationService: Web platform detected, skipping native push registration');
      this.initialized = true;
      return;
    }

    try {
      console.log('PushNotificationService: requesting notification permissions...');
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.warn('PushNotificationService: notification permission not granted');
        this.initialized = true;
        return;
      }

      console.log('PushNotificationService: registering for push notifications...');
      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token: Token) => {
        console.log('PushNotificationService: registration token received', token.value);
        await this.saveTokenForCurrentUser(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('PushNotificationService: registration error', error);
      });

      this.initialized = true;
    } catch (err) {
      console.error('PushNotificationService: init failed', err);
    }
  }

  private async saveTokenForCurrentUser(token: string): Promise<void> {
    try {
      const user = await this.authService.waitForAuthInit();
      if (!user) {
        console.warn('PushNotificationService: no authenticated user; token will not be saved');
        return;
      }

      const userDocRef = doc(this.db, 'users', user.uid);

      // Store tokens in an array field so a user can have multiple devices.
      await setDoc(
        userDocRef,
        {
          pushTokens: arrayUnion(token)
        },
        { merge: true }
      );

      console.log('PushNotificationService: token saved for user', user.uid);
    } catch (err) {
      console.error('PushNotificationService: failed to save token', err);
    }
  }
}
