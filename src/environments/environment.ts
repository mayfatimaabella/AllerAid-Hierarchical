// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import { firebaseConfig } from '../app/core/services/firebase.config';


export const environment = {
  production: false,
  firebaseConfig,
  // Backend endpoint for sending emergency push notifications (Cloud Function / API).
  pushNotificationEndpoint: 'https://us-central1-alleraid2.cloudfunctions.net/sendEmergencyPush'
  // Note: Using Leaflet for map visualization and Google Maps API for live location tracking
};



/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
