import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { doc,setDoc,serverTimestamp,arrayUnion,collection,getDocs,writeBatch,arrayRemove} from 'firebase/firestore';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationService {
  private listenersAdded = false;
  private registering = false;

  // Emits whenever an emergency push data payload arrives while the app
  // is in the foreground, so any page (home, responder dashboard) can
  // react — show a banner, play a sound, navigate, etc.
  private emergencyReceivedSubject = new Subject<any>();
  emergencyReceived$ = this.emergencyReceivedSubject.asObservable();

  constructor(
    private authService: AuthService,
    private firebaseService: FirebaseService,
    private router: Router
  ) {}

  async init(): Promise<void> {
    console.log('PushNotificationService init called');

    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on a real Android/iOS app, not browser.');
      return;
    }

    this.addPushListenersOnce();

    if (this.registering) {
      console.log('Push registration already in progress');
      return;
    }

    this.registering = true;

    try {
      console.log('Requesting push notification permission...');
      const permission = await PushNotifications.requestPermissions();
      console.log('Push permission result:', permission);

      if (permission.receive !== 'granted') {
        console.warn('Push notification permission not granted');
        return;
      }

      const localPermission = await LocalNotifications.requestPermissions();
      console.log('Local notification permission result:', localPermission);

      console.log('Registering device for push notifications...');
      await PushNotifications.register();

    } catch (error) {
      console.error('Push notification init failed:', error);
    } finally {
      this.registering = false;
    }
  }

  private addPushListenersOnce(): void {
    if (this.listenersAdded) {
      console.log('Push listeners already added');
      return;
    }

    this.listenersAdded = true;

    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('FCM registration token received:', token.value);

      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        console.warn('No logged-in user. Cannot save push token.');
        return;
      }

          const db = this.firebaseService.getDb();

      // Ensure this device token belongs to only one user.
      await this.removeTokenFromOtherUsers(
        token.value,
        currentUser.uid
      );

      await setDoc(
        doc(db, `users/${currentUser.uid}`),
        {
          fcmToken: token.value,
          pushTokens: arrayUnion(token.value),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      console.log('FCM token saved to Firestore for user:', currentUser.uid);
    });

    PushNotifications.addListener('registrationError', error => {
      console.error('Push registration error:', error);
    });

    // Fires when the app is FOREGROUND and a push data payload arrives.
    // The OS does not show a tray banner in this state, so we have to:
    //   1. write a real "delivered" ack (independent of the backend's report)
    //   2. surface it ourselves (in-app banner + local notification)
    PushNotifications.addListener('pushNotificationReceived', async (notification: any) => {
      console.log('Push received while app is open:', notification);

      const data = notification?.data ?? notification?.notification?.data;
      if (data?.type !== 'emergency' || !data?.emergencyId) return;

      await this.acknowledgeDelivery(data.emergencyId);

      // Let subscribed pages react (banner/sound/navigation).
      this.emergencyReceivedSubject.next(data);

      // Also fire a local notification so it's noticeable even if the
      // person isn't looking at the screen right now (e.g. phone locked
      // but app technically foregrounded/backgrounded-resumable).
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now() % 2147483647,
              title: data.title || 'EMERGENCY ALERT',
              body: data.body || `${data.patientName || 'A buddy'} needs immediate help!`,
              extra: data,
            }
          ]
        });
      } catch (err) {
        console.warn('Could not schedule local notification for foreground push:', err);
      }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', notification => {
      console.log('Push tapped:', notification);

      const data = notification.notification.data;

      if (data?.type === 'emergency' && data?.emergencyId) {
        this.router.navigate(['/tabs/responder-dashboard'],{
          queryParams: {emergency: data.emergencyId}
  }
);
      }
    });

    LocalNotifications.addListener('localNotificationActionPerformed', notification => {
      console.log('Foreground local notification tapped:', notification);

      const data = notification.notification.extra;

    if (data?.type === 'emergency' && data?.emergencyId) {
      this.router.navigate(['/tabs/responder-dashboard'], {
        queryParams: { emergency: data.emergencyId }
      });
    }
  });
  }

  private async acknowledgeDelivery(emergencyId: string): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      const db = this.firebaseService.getDb();

      await setDoc(
        doc(db, 'emergencies', emergencyId),
        {
          notificationStatus: {
            [currentUser.uid]: 'delivered'
          },
          notificationDeliveredAt: {
            [currentUser.uid]: serverTimestamp()
          }
        },
        { merge: true }
      );

      console.log('Emergency delivery acknowledged:', emergencyId);
    } catch (error) {
      console.warn('Could not write delivery acknowledgment:', error);
    }
  }

  private async removeTokenFromOtherUsers(
  token: string,
  currentUserId: string
): Promise<void> {

  const db = this.firebaseService.getDb();

  const snapshot = await getDocs(collection(db, 'users'));

  const batch = writeBatch(db);

  snapshot.forEach(userDoc => {
    if (userDoc.id === currentUserId) {
      return;
    }

    const data = userDoc.data();

    const pushTokens = Array.isArray(data['pushTokens'])
      ? data['pushTokens']
      : [];

    if (pushTokens.includes(token)) {
      batch.update(userDoc.ref, {
        pushTokens: arrayRemove(token)
      });

      if (data['fcmToken'] === token) {
        batch.update(userDoc.ref, {
          fcmToken: null
        });
      }

      console.log(
        `Removed duplicate token from user ${userDoc.id}`
      );
    }
  });

  await batch.commit();
}
}