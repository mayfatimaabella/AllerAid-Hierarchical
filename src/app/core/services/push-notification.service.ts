import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import {
  doc,
  setDoc,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private initialized = false;

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService
  ) {}

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on a real Android/iOS app, not browser.');
      return;
    }

    const permission = await PushNotifications.requestPermissions();

    if (permission.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    this.initialized = true;

    PushNotifications.addListener('registration', async (token: Token) => {
      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        console.warn('No logged-in user. Cannot save push token.');
        return;
      }

      const db = this.firebaseService.getDb();

      await setDoc(
        doc(db, `users/${currentUser.uid}`),
        {
          fcmToken: token.value,
          pushTokens: arrayUnion(token.value),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      console.log('FCM token saved:', token.value);
    });

    PushNotifications.addListener('registrationError', error => {
      console.error('Push registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('Push received while app is open:', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', notification => {
      console.log('Push tapped:', notification);

      const data = notification.notification.data;

      if (data?.type === 'emergency' && data?.emergencyId) {
        window.location.href = `/tabs/responder-dashboard?emergency=${data.emergencyId}`;
      }
    });

    await PushNotifications.register();
  }
}