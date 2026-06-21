import { firebaseConfig } from '../app/core/services/firebase.config';

export const environment = {
  production: true,
  firebaseConfig,
  
  pushNotificationEndpoint: 'https://us-central1-alleraid2.cloudfunctions.net/sendEmergencyPush',
};
