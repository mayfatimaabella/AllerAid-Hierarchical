import { firebaseConfig } from '../app/core/services/firebase.config';

export const environment = {
  production: true,
  firebaseConfig,
  // Production endpoint for emergency push notifications (Cloud Function / API)
  pushNotificationEndpoint: 'https://us-central1-alleraid2.cloudfunctions.net/sendEmergencyPush'
};
