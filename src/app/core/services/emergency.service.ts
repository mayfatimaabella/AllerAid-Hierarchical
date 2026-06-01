import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase.config';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  Timestamp,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { EmergencyNotificationService } from './emergency-notification.service';
import { UserService } from './user.service';

export interface EmergencyAlert {
  id?: string;
  userId: string;
  userName: string;
  timestamp: any;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  responderLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  allergies?: string[];
  instruction?: string;
  emergencyInstruction?: string;
  status: 'active' | 'responding' | 'resolved';
  buddyIds: string[];
  responderId?: string;
  responderName?: string;
  estimatedArrival?: number;
  responseTimestamp?: any;
  distance?: number;
  displayAddress?: string;
  buddyResponses?: {
    [buddyId: string]: {
      status: 'responded' | 'cannot_respond';
      timestamp: any;
      name?: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyService {
  private db;

  // FIX #4: Split into two separate watch ID properties so patient location
  // tracking and responder location tracking never overwrite each other.
  private patientLocationWatchId: string | null = null;
  private responderLocationWatchId: string | null = null;

  private backgroundLocationWatchId: string | null = null;
  private cachedLocation: Position | null = null;
  private isBackgroundTrackingActive = false;

  private userEmergencySubject = new BehaviorSubject<EmergencyAlert | null>(null);
  userEmergency$ = this.userEmergencySubject.asObservable();

  private emergencyResponseSubject = new BehaviorSubject<any | null>(null);
  emergencyResponse$ = this.emergencyResponseSubject.asObservable();

  constructor(
    private emergencyNotificationService?: EmergencyNotificationService,
    private userService?: UserService
  ) {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  /**
   * Send an emergency alert to the user's buddies with automatic notifications
   */
  async sendEmergencyAlert(
    userId: string,
    userName: string,
    buddyIds: string[],
    allergies: string[] = [],
    instruction: string = ''
  ): Promise<string> {
    try {
      console.log('Starting emergency alert process...');

      let position: Position | null = this.cachedLocation;
      if (!position) {
        try {
          position = await this.getCurrentLocation();
          this.cachedLocation = position;
        } catch (geoError) {
          const code = (geoError as any)?.code;
          console.warn('Geolocation unavailable, proceeding without precise location.', {
            code,
            message: (geoError as any)?.message || String(geoError)
          });
        }
      } else {
        console.log('Using cached location for emergency alert (no waiting time)');
      }

      const location = position
        ? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            ...(position.coords.accuracy !== undefined
              ? { accuracy: position.coords.accuracy }
              : {})
          }
        : null;

      const emergencyData: EmergencyAlert = {
        userId,
        userName,
        timestamp: Timestamp.now(),
        location,
        allergies,
        instruction,
        status: 'active',
        buddyIds
      };

      const docRef = await addDoc(collection(this.db, 'emergencies'), emergencyData);
      const emergencyId = docRef.id;

      emergencyData.id = emergencyId;

      console.log('Emergency alert created in Firestore:', emergencyId);

      // Reverse geocode in the background and write displayAddress to Firestore
      // so any listener (home page, responder dashboard, etc.) gets the address
      // without each component needing its own geocoding logic.
      if (location) {
        this.reverseGeocodeAndSave(emergencyId, location.latitude, location.longitude);
      }

      // FIX #4: Use startPatientLocationTracking (renamed) so the watch ID is
      // stored in patientLocationWatchId and not overwritten by responder tracking.
      this.startPatientLocationTracking(emergencyId);
      this.refreshEmergencyLocation(emergencyId);

      this.listenForResponses(emergencyId, userId);

      if (this.emergencyNotificationService && this.userService) {
        try {
          console.log('Sending emergency notifications to buddies...');

          const userProfile = await this.userService.getCompleteEmergencyProfile(userId);

          await this.emergencyNotificationService.sendEmergencyNotifications(
            emergencyData,
            userProfile
          );

          console.log('Emergency notifications sent successfully');

        } catch (notificationError) {
          console.error('Emergency notifications failed:', notificationError);
        }
      } else {
        console.log('Emergency notification service not available');
      }

      return emergencyId;
    } catch (error) {
      console.error('Error sending emergency alert:', error);
      throw error;
    }
  }

  /**
   * Get the current location
   */
  async getCurrentLocation(): Promise<Position> {
    if (Capacitor.isNativePlatform()) {
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        throw new Error('Geolocation is not available on this device');
      }

      await Geolocation.requestPermissions();

      console.log('Attempting to get current location...');

      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 300000
        });

        console.log('Got high accuracy location:', position);
        return position;

      } catch (highAccuracyError) {
        console.log('High accuracy failed, trying low accuracy...', highAccuracyError);

        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 600000
          });

          console.log('Got low accuracy location:', position);
          return position;
        } catch (lowAccuracyError) {
          console.error('Both location attempts failed:', lowAccuracyError);
          const errorMessage = lowAccuracyError instanceof Error ? lowAccuracyError.message : 'Unknown location error';
          throw new Error(`Could not obtain location: ${errorMessage}`);
        }
      }
    } else {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser'));
          return;
        }

        console.log('Attempting to get web location...');

        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Got high accuracy web location:', position);
            const capacitorPosition: Position = {
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed
              },
              timestamp: position.timestamp
            };
            resolve(capacitorPosition);
          },
          (error) => {
            console.log('High accuracy web location failed, trying low accuracy...', error);

            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('Got low accuracy web location:', position);
                const capacitorPosition: Position = {
                  coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    altitude: position.coords.altitude,
                    altitudeAccuracy: position.coords.altitudeAccuracy,
                    heading: position.coords.heading,
                    speed: position.coords.speed
                  },
                  timestamp: position.timestamp
                };
                resolve(capacitorPosition);
              },
              (fallbackError) => {
                console.error('Both web location attempts failed:', fallbackError);
                reject(new Error(`Geolocation error: ${fallbackError.message}`));
              },
              {
                enableHighAccuracy: false,
                timeout: 15000,
                maximumAge: 600000
              }
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 300000
          }
        );
      });
    }
  }

  /**
   * Check if geolocation permission is granted without showing prompts
   */
  private checkGeolocationPermission(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => { resolve(true); },
        (error) => { resolve(error.code !== 1); },
        { timeout: 1000, maximumAge: Infinity }
      );
    });
  }

  /**
   * FIX #4: Renamed from startLocationTracking to startPatientLocationTracking.
   * Now writes to patientLocationWatchId so it cannot be overwritten by
   * startResponderLocationTracking.
   */
  async startPatientLocationTracking(emergencyId: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        console.error('Geolocation is not available on this device');
        return;
      }

      try {
        this.patientLocationWatchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
          },
          (position) => {
            if (position) {
              this.updateEmergencyLocation(emergencyId, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
              console.log('Real-time patient location updated:', position.coords.latitude, position.coords.longitude);
            }
          }
        );
      } catch (error) {
        console.error('Error starting patient location tracking:', error);
      }
    } else {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        return;
      }

      const hasPermission = await this.checkGeolocationPermission();
      if (!hasPermission) {
        console.warn('Geolocation permission denied - skipping patient location tracking');
        return;
      }

      const watchId = setInterval(async () => {
        try {
          const position = await this.getCurrentLocation();
          this.updateEmergencyLocation(emergencyId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          console.log('Patient location updated:', position.coords.latitude, position.coords.longitude);
        } catch (error) {
          const errorMsg = (error as any)?.message || String(error);
          console.warn('Patient location update failed:', errorMsg);
          if (errorMsg.includes('User denied') || errorMsg.includes('Permission denied')) {
            clearInterval(parseInt(this.patientLocationWatchId!));
            this.patientLocationWatchId = null;
            console.warn('Patient location tracking stopped due to permission change');
          }
        }
      }, 5000);

      this.patientLocationWatchId = watchId.toString();
    }
  }

  /**
   * Stop patient location tracking
   * FIX #4: Now explicitly clears patientLocationWatchId only.
   */
  async stopPatientLocationTracking(): Promise<void> {
    if (this.patientLocationWatchId !== null) {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: this.patientLocationWatchId });
      } else {
        clearInterval(parseInt(this.patientLocationWatchId));
      }
      this.patientLocationWatchId = null;
    }
  }

  /**
   * Stop responder location tracking
   * FIX #4: Now explicitly clears responderLocationWatchId only.
   */
  async stopResponderLocationTracking(): Promise<void> {
    if (this.responderLocationWatchId !== null) {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: this.responderLocationWatchId });
      } else {
        clearInterval(parseInt(this.responderLocationWatchId));
      }
      this.responderLocationWatchId = null;
    }
  }

  /**
   * Stop all location tracking (patient + responder)
   */
  async stopLocationTracking(): Promise<void> {
    await this.stopPatientLocationTracking();
    await this.stopResponderLocationTracking();
  }

  /**
   * Cache the user's last known location.
   * FIX #6: isBackgroundTrackingActive is now only set after a successful cache.
   */
  async startBackgroundLocationTracking(): Promise<void> {
    try {
      const position = await this.getCurrentLocation();
      this.cachedLocation = position;
      this.isBackgroundTrackingActive = true; // FIX #6: Only set on success

      console.log(
        'Location cached for emergency use:',
        position.coords.latitude,
        position.coords.longitude
      );
    } catch (error) {
      // FIX #6: Flag stays false if caching fails
      console.warn('Failed to cache location:', error);
    }
  }

  /**
   * Stop background location tracking
   */
  async stopBackgroundLocationTracking(): Promise<void> {
    if (this.backgroundLocationWatchId !== null) {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: this.backgroundLocationWatchId });
      } else {
        clearInterval(parseInt(this.backgroundLocationWatchId));
      }
      this.backgroundLocationWatchId = null;
      this.isBackgroundTrackingActive = false;
      console.log('Background location tracking stopped');
    }
  }

  /**
   * Get cached location
   */
  getCachedLocation(): Position | null {
    return this.cachedLocation;
  }

  /**
   * Refresh location after emergency is created
   */
  async refreshEmergencyLocation(emergencyId: string): Promise<void> {
    try {
      const freshPosition = await this.getCurrentLocation();
      this.cachedLocation = freshPosition;

      await this.updateEmergencyLocation(emergencyId, {
        latitude: freshPosition.coords.latitude,
        longitude: freshPosition.coords.longitude,
        accuracy: freshPosition.coords.accuracy
      });

      console.log('Emergency location refreshed');
    } catch (error) {
      console.warn('Could not refresh emergency location:', error);
    }
  }

  /**
   * Update emergency location in Firestore
   */
  async updateEmergencyLocation(
    emergencyId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);
      await updateDoc(emergencyRef, { location });
    } catch (error) {
      console.error('Error updating emergency location:', error);
    }
  }

  /**
   * Listen for responses to the emergency
   */
  listenForResponses(emergencyId: string, userId: string): void {
    const emergencyRef = doc(this.db, 'emergencies', emergencyId);

    onSnapshot(emergencyRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = { id: docSnapshot.id, ...docSnapshot.data() } as EmergencyAlert;

        if (data.status === 'responding' && data.responderId) {
          this.emergencyResponseSubject.next({
            responderId: data.responderId,
            responderName: data.responderName || 'A buddy',
            emergencyId: data.id,
            location: data.location
          });
        }

        this.userEmergencySubject.next(data);
      }
    });
  }

  /**
   * Respond to an emergency (for buddies/responders)
   */
  async respondToEmergency(
    emergencyId: string,
    responderId: string,
    responderName: string
  ): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);

      const responderPosition = await this.getCurrentLocation();

      const responderLocation = {
        latitude: responderPosition.coords.latitude,
        longitude: responderPosition.coords.longitude,
        accuracy: responderPosition.coords.accuracy
      };

      const emergencyDoc = await getDoc(emergencyRef);

      if (!emergencyDoc.exists()) {
        throw new Error('Emergency alert not found.');
      }

      const emergencyData = emergencyDoc.data() as EmergencyAlert;

      if (!emergencyData.location) {
        throw new Error('Patient location is not available yet.');
      }

      const distance = this.calculateDistance(
        responderLocation.latitude,
        responderLocation.longitude,
        emergencyData.location.latitude,
        emergencyData.location.longitude
      );

      const estimatedArrival = this.calculateETA(distance);

      await updateDoc(emergencyRef, {
        status: 'responding',
        responderId,
        responderName,
        responderLocation,
        responseTimestamp: Timestamp.now(),
        distance: Math.round(distance * 100) / 100,
        estimatedArrival,
        [`buddyResponses.${responderId}`]: {
          status: 'responded',
          name: responderName,
          timestamp: Timestamp.now()
        }
      });

      // FIX #4: Now calls startResponderLocationTracking which uses its own
      // responderLocationWatchId — won't overwrite patientLocationWatchId.
      this.startResponderLocationTracking(emergencyId, responderId);

      console.log(
        `${responderName} is responding - ETA: ${estimatedArrival} minutes, Distance: ${distance.toFixed(1)}km`
      );

    } catch (error) {
      console.error('Error responding to emergency:', error);
      throw error;
    }
  }

  /**
   * FIX #4: Now writes to responderLocationWatchId instead of locationWatchId,
   * preventing patient tracking from being orphaned.
   */
  async startResponderLocationTracking(emergencyId: string, responderId: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        console.error('Geolocation is not available on this device');
        return;
      }

      try {
        this.responderLocationWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000 },
          (position) => {
            if (position) {
              this.updateResponderLocation(emergencyId, responderId, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
            }
          }
        );
      } catch (error) {
        console.error('Error starting responder location tracking:', error);
      }
    } else {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        return;
      }

      const watchId = setInterval(async () => {
        try {
          const position = await this.getCurrentLocation();
          this.updateResponderLocation(emergencyId, responderId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        } catch (error) {
          console.error('Error updating responder location:', error);
        }
      }, 10000);

      this.responderLocationWatchId = watchId.toString();
    }
  }

  /**
   * Update responder location in Firestore
   */
  async updateResponderLocation(
    emergencyId: string,
    responderId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);
      await updateDoc(emergencyRef, { responderLocation: location });
    } catch (error) {
      console.error('Error updating responder location:', error);
    }
  }

  /**
   * Record that a buddy cannot respond to an emergency
   */
  async recordBuddyCannotRespond(
    emergencyId: string,
    buddyId: string,
    buddyName: string
  ): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);
      await updateDoc(emergencyRef, {
        [`buddyResponses.${buddyId}`]: {
          status: 'cannot_respond',
          name: buddyName,
          timestamp: Timestamp.now()
        }
      });

      console.log(`Recorded cannot_respond for buddy ${buddyName} on emergency ${emergencyId}`);
    } catch (error) {
      console.error('Error recording buddy cannot respond:', error);
      throw error;
    }
  }

  /**
   * Mark an emergency as resolved
   */
  async resolveEmergency(emergencyId: string, patientCondition?: string): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);

      const updateData: any = {
        status: 'resolved',
        resolvedAt: Timestamp.now()
      };

      if (patientCondition !== undefined) {
        updateData.patientCondition = patientCondition;
      }

      await updateDoc(emergencyRef, updateData);

      // FIX #4: stopLocationTracking now stops both patient and responder watches.
      this.stopLocationTracking();
    } catch (error) {
      console.error('Error resolving emergency:', error);
      throw error;
    }
  }

  /**
   * Get active emergencies for a specific buddy
   */
  getActiveEmergenciesForBuddy(buddyId: string): Observable<EmergencyAlert[]> {
    const emergenciesSubject = new BehaviorSubject<EmergencyAlert[]>([]);

    const q = query(
      collection(this.db, 'emergencies'),
      where('buddyIds', 'array-contains', buddyId),
      where('status', 'in', ['active', 'responding'])
    );

    onSnapshot(q, (querySnapshot) => {
      const emergencies: EmergencyAlert[] = [];
      querySnapshot.forEach((doc) => {
        emergencies.push({ id: doc.id, ...doc.data() } as EmergencyAlert);
      });
      emergenciesSubject.next(emergencies);
    });

    return emergenciesSubject.asObservable();
  }

  /**
   * Get emergencies for a buddy by status
   */
  async getBuddyEmergenciesByStatus(
    buddyId: string,
    statuses: ('active' | 'responding' | 'resolved')[]
  ): Promise<EmergencyAlert[]> {
    try {
      const emergenciesRef = collection(this.db, 'emergencies');
      const q = query(
        emergenciesRef,
        where('buddyIds', 'array-contains', buddyId),
        where('status', 'in', statuses)
      );

      const snapshot = await getDocs(q);
      const emergencies: EmergencyAlert[] = [];
      snapshot.forEach((docSnap) => {
        emergencies.push({ id: docSnap.id, ...(docSnap.data() as any) } as EmergencyAlert);
      });
      return emergencies;
    } catch (error) {
      console.error('Error getting buddy emergencies by status:', error);
      return [];
    }
  }

  /**
   * Get emergencies initiated by a specific user by status
   */
  async getUserEmergenciesByStatus(
    userId: string,
    statuses: ('active' | 'responding' | 'resolved')[]
  ): Promise<EmergencyAlert[]> {
    try {
      const emergenciesRef = collection(this.db, 'emergencies');
      const q = query(
        emergenciesRef,
        where('userId', '==', userId),
        where('status', 'in', statuses)
      );

      const snapshot = await getDocs(q);
      const emergencies: EmergencyAlert[] = [];
      snapshot.forEach((docSnap) => {
        emergencies.push({ id: docSnap.id, ...(docSnap.data() as any) } as EmergencyAlert);
      });
      return emergencies;
    } catch (error) {
      console.error('Error getting user emergencies by status:', error);
      return [];
    }
  }

  /**
   * Get a specific emergency by ID
   */
  async getEmergencyById(emergencyId: string): Promise<EmergencyAlert | null> {
    try {
      const docRef = doc(this.db, 'emergencies', emergencyId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as EmergencyAlert;
      }
      return null;
    } catch (error) {
      console.error('Error getting emergency by ID:', error);
      throw error;
    }
  }

  /**
   * Reverse geocodes coordinates using the Google Maps Geocoding API and saves
   * the human-readable address as displayAddress on the Firestore emergency doc.
   * Runs fire-and-forget so it never blocks the emergency alert flow.
   * Falls back gracefully — if geocoding fails the field simply stays unset and
   * the template falls back to showing raw coordinates.
   */
  private async reverseGeocodeAndSave(
    emergencyId: string,
    latitude: number,
    longitude: number
  ): Promise<void> {
    try {
      // Uses the Google Maps Geocoding API. No API key is required for the
      // maps/api/geocode endpoint when called from an authorized domain that
      // already has the Maps JS SDK loaded; adjust the URL if you use a key.
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&result_type=street_address|route|sublocality|locality`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Geocode HTTP ${response.status}`);

      const data = await response.json();

      let displayAddress = '';

      if (data.status === 'OK' && data.results?.length > 0) {
        // Prefer the most specific result's formatted_address
        displayAddress = data.results[0].formatted_address || '';
      }

      if (!displayAddress) {
        // Fallback: build a short address from components of the first result
        const components: string[] = (data.results?.[0]?.address_components || [])
          .filter((c: any) =>
            c.types.some((t: string) =>
              ['route', 'sublocality', 'locality', 'administrative_area_level_1'].includes(t)
            )
          )
          .map((c: any) => c.short_name || c.long_name);
        displayAddress = components.join(', ');
      }

      if (displayAddress) {
        const emergencyRef = doc(this.db, 'emergencies', emergencyId);
        await updateDoc(emergencyRef, { displayAddress });
        console.log('Display address saved:', displayAddress);
      }

    } catch (error) {
      // Non-fatal — raw coordinates will be shown as fallback
      console.warn('Reverse geocoding failed, address will show as coordinates:', error);
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate estimated time of arrival based on distance
   */
  private calculateETA(distanceKm: number): number {
    const averageSpeed = 30;
    const timeHours = distanceKm / averageSpeed;
    const timeMinutes = Math.round(timeHours * 60);
    return Math.max(timeMinutes, 2);
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
