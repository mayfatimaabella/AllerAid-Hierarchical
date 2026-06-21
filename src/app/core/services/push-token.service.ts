import { Injectable } from '@angular/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class PushTokenService {
  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService
  ) {}

  async initPushNotifications(): Promise<void> {
    const permission = await PushNotifications.requestPermissions();

    if (permission.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    await PushNotifications.register();

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
          pushTokens: [token.value],
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
    });
  }
}