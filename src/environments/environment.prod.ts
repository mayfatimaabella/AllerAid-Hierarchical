import { firebaseConfig } from '../app/core/services/firebase.config';

export const environment = {
  production: true,
  firebaseConfig,
  
  pushNotificationEndpoint: 'https://alleraid-push-backend.onrender.com/send-emergency-push',
};
