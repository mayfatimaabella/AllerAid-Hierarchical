// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import { firebaseConfig } from '../app/core/services/firebase.config';


export const environment = {
  production: false,
  firebaseConfig,
  // Backend endpoint for sending emergency push notifications (Cloud Function / API).
  pushNotificationEndpoint: 'https://alleraid-push-backend.onrender.com/send-emergency-push',
  // Note: Using Leaflet for map visualization and Google Maps API for live location tracking
};
