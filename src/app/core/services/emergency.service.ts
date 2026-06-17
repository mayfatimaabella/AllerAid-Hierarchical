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

  private patientLocationWatchId: string | null = null;
  private responderLocationWatchId: string | null = null;

  private backgroundLocationWatchId: string | null = null;
  private cachedLocation: Position | null = null;
  private cachedLocationTimestamp: number | null = null;

  private userEmergencySubject = new BehaviorSubject<EmergencyAlert | null>(null);
  userEmergency$ = this.userEmergencySubject.asObservable();

  private emergencyResponseSubject = new BehaviorSubject<any | null>(null);
  emergencyResponse$ = this.emergencyResponseSubject.asObservable();
  
  private emergencySnapshotUnsubscribe: (() => void) | null = null;

  private lastGeocodeTime: number = 0;
  private readonly GEOCODE_DEBOUNCE_MS = 30_000;

  constructor(
    private emergencyNotificationService?: EmergencyNotificationService,
    private userService?: UserService
  ) {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  resolveEmergencyInstruction(medicalProfile: any, fallback: string = ''): string {
    const fromMessage = (medicalProfile as any)?.emergencyMessage?.instructions;
    return (
      (typeof fromMessage === 'string' && fromMessage.trim()) ||
      medicalProfile?.generalEmergencyInstruction?.trim() ||
      fallback ||
      ''
    );
  }

  /**
   * Send an emergency alert to the user's buddies with automatic notifications.
   * locationData is optional — alert proceeds without location if unavailable.
   */
  async sendEmergencyAlert(
    userId: string,
    userName: string,
    buddyIds: string[],
    allergies: string[] = [],
    instruction: string = '',
    locationData?: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<string> {
    
    const existing = await this.getUserEmergenciesByStatus(userId, ['active', 'responding']);
    if (existing.length > 0) {
      console.warn('An active emergency already exists. Returning existing ID.');
      return existing[0].id!;
    }

    try {
      console.log('Starting emergency alert process...');

      const location =
        locationData &&
        typeof locationData.latitude === 'number' &&
        typeof locationData.longitude === 'number'
          ? {
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
            }
          : null;

      if (!location) {
        console.warn('No valid location provided — emergency will be created without location.');
      }

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

      if (location) {
        this.debouncedReverseGeocodeAndSave(emergencyId, location.latitude, location.longitude);
      }

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
   * Get the current location.
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
          const errorMessage =
            lowAccuracyError instanceof Error ? lowAccuracyError.message : 'Unknown location error';
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

        const toCapacitor = (p: GeolocationPosition): Position => ({
          coords: {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
            accuracy: p.coords.accuracy,
            altitude: p.coords.altitude,
            altitudeAccuracy: p.coords.altitudeAccuracy,
            heading: p.coords.heading,
            speed: p.coords.speed
          },
          timestamp: p.timestamp
        });

        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Got high accuracy web location:', position);
            resolve(toCapacitor(position));
          },
          (error) => {
            console.log('High accuracy web location failed, trying low accuracy...', error);
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('Got low accuracy web location:', position);
                resolve(toCapacitor(position));
              },
              (fallbackError) => {
                console.error('Both web location attempts failed:', fallbackError);
                reject(new Error(`Geolocation error: ${fallbackError.message}`));
              },
              { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
            );
          },
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 300000 }
        );
      });
    }
  }

  /**
   * Check if geolocation permission is granted without showing prompts.
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
   * Start continuously tracking the patient's location and writing it to Firestore.
   */
  async startPatientLocationTracking(emergencyId: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        console.error('Geolocation is not available on this device');
        return;
      }

      try {
        this.patientLocationWatchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
          (position) => {
            if (position) {
              this.updateEmergencyLocation(emergencyId, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
              console.log(
                'Real-time patient location updated:',
                position.coords.latitude,
                position.coords.longitude
              );
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
          console.log(
            'Patient location updated:',
            position.coords.latitude,
            position.coords.longitude
          );
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

  /** Stop patient location tracking only. */
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

  /** Stop responder location tracking only. */
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

  /** Stop all location tracking (patient + responder). */
  async stopLocationTracking(): Promise<void> {
    await this.stopPatientLocationTracking();
    await this.stopResponderLocationTracking();
  }

  /**
   * Cache the user's last known location.
   */
  async startBackgroundLocationTracking(): Promise<void> {
    const CACHE_TTL_MS = 5 * 60 * 1000;
    const now = Date.now();

    const cacheIsStale =
      !this.cachedLocationTimestamp ||
      now - this.cachedLocationTimestamp > CACHE_TTL_MS;

    if (!cacheIsStale) {
      console.log('Cached location is still fresh — skipping refresh.');
      return;
    }

    try {
      const position = await this.getCurrentLocation();
      this.cachedLocation = position;
      this.cachedLocationTimestamp = Date.now();
      console.log(
        'Location cached for emergency use:',
        position.coords.latitude,
        position.coords.longitude
      );
    } catch (error) {
      console.warn('Failed to cache location:', error);
    }
  }

  /** Stop background location tracking. */
  async stopBackgroundLocationTracking(): Promise<void> {
    if (this.backgroundLocationWatchId !== null) {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.clearWatch({ id: this.backgroundLocationWatchId });
      } else {
        clearInterval(parseInt(this.backgroundLocationWatchId));
      }
      this.backgroundLocationWatchId = null;
      console.log('Background location tracking stopped');
    }
  }

  /** Return the cached location. */
  getCachedLocation(): Position | null {
    return this.cachedLocation;
  }

  /** Fetch a fresh location and write it to the emergency document immediately. */
  async refreshEmergencyLocation(emergencyId: string): Promise<void> {
    try {
      const freshPosition = await this.getCurrentLocation();
      this.cachedLocation = freshPosition;
      this.cachedLocationTimestamp = Date.now();

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
   * Update emergency location in Firestore.
   */
  async updateEmergencyLocation(
    emergencyId: string,
    location: { latitude: number; longitude: number; accuracy?: number }
  ): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);
      await updateDoc(emergencyRef, { location });

      const emergencySnap = await getDoc(emergencyRef);
      const emergencyData = emergencySnap.data() as any;

      if (!emergencyData?.displayAddress) {
        this.debouncedReverseGeocodeAndSave(
          emergencyId,
          location.latitude,
          location.longitude
        );
      }
    } catch (error) {
      console.error('Error updating emergency location:', error);
    }
  }

  /**
   * Listen for Firestore changes on the emergency document.
   */
  listenForResponses(emergencyId: string, userId: string): void {
    if (this.emergencySnapshotUnsubscribe) {
      this.emergencySnapshotUnsubscribe();
      this.emergencySnapshotUnsubscribe = null;
    }

    const emergencyRef = doc(this.db, 'emergencies', emergencyId);

    const unsubscribe = onSnapshot(emergencyRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = { id: docSnapshot.id, ...docSnapshot.data() } as EmergencyAlert;

        if (data.status === 'responding' && data.responderId) {
          this.emergencyResponseSubject.next({
            responderId: data.responderId,
            responderName: data.responderName || 'A buddy',
            emergencyId: data.id,
            location: data.location,
            estimatedArrival: data.estimatedArrival || 0,
            distance: data.distance || 0
          });
        }

        this.userEmergencySubject.next(data);
      }
    });

    this.emergencySnapshotUnsubscribe = unsubscribe;
  }

  /**
   * Stop listening to the active emergency document.
   */
  stopListeningForResponses(): void {
    if (this.emergencySnapshotUnsubscribe) {
      this.emergencySnapshotUnsubscribe();
      this.emergencySnapshotUnsubscribe = null;
    }
  }

  /** Respond to an emergency (for buddies / responders). */
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
      if (!emergencyDoc.exists()) throw new Error('Emergency alert not found.');

      const emergencyData = emergencyDoc.data() as EmergencyAlert;
      if (!emergencyData.location) throw new Error('Patient location is not available yet.');

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

      this.startResponderLocationTracking(emergencyId, responderId);

      console.log(
        `${responderName} is responding — ETA: ${estimatedArrival} min, Distance: ${distance.toFixed(1)} km`
      );
    } catch (error) {
      console.error('Error responding to emergency:', error);
      throw error;
    }
  }

  /** Track the responder's live location. */
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

  /** Write the responder's latest coordinates to Firestore. */
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

  /** Record that a buddy cannot respond. */
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

  /** Mark an emergency as resolved and stop all tracking. */
  async resolveEmergency(
    emergencyId: string,
    patientCondition?: string,
    resolvedBy?: string,
    resolvedByName?: string
  ): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);

      const updateData: any = {
        status: 'resolved',
        resolvedAt: Timestamp.now()
      };

      if (patientCondition !== undefined) updateData.patientCondition = patientCondition;
      if (resolvedBy) updateData.resolvedBy = resolvedBy;
      if (resolvedByName) updateData.resolvedByName = resolvedByName;

      await updateDoc(emergencyRef, updateData);

      this.stopListeningForResponses();
      await this.stopLocationTracking();
    } catch (error) {
      console.error('Error resolving emergency:', error);
      throw error;
    }
  }

  /** Observable stream of active emergencies where buddyId is listed. */
  getActiveEmergenciesForBuddy(buddyId: string): Observable<EmergencyAlert[]> {
    const emergenciesSubject = new BehaviorSubject<EmergencyAlert[]>([]);

    const q = query(
      collection(this.db, 'emergencies'),
      where('buddyIds', 'array-contains', buddyId),
      where('status', 'in', ['active', 'responding'])
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const emergencies: EmergencyAlert[] = [];
      querySnapshot.forEach((d) => {
        emergencies.push({ id: d.id, ...d.data() } as EmergencyAlert);
      });
      emergenciesSubject.next(emergencies);
    });

    emergenciesSubject.subscribe({ error: () => unsubscribe() });

    return new Observable<EmergencyAlert[]>((subscriber) => {
      const innerSub = emergenciesSubject.subscribe(subscriber);
      return () => {
        innerSub.unsubscribe();
        unsubscribe();
      };
    });
  }

  /** Fetch emergencies for a buddy filtered by status. */
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

  /** Fetch emergencies initiated by a user filtered by status. */
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

  /** Fetch a single emergency document by its ID. */
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

  private debouncedReverseGeocodeAndSave(
    emergencyId: string,
    latitude: number,
    longitude: number
  ): void {
    const now = Date.now();
    if (now - this.lastGeocodeTime < this.GEOCODE_DEBOUNCE_MS) {
      console.log('Geocode debounced — skipping');
      return;
    }
    this.lastGeocodeTime = now;
    this.reverseGeocodeAndSave(emergencyId, latitude, longitude);
  }

  private async reverseGeocodeAndSave(
    emergencyId: string,
    latitude: number,
    longitude: number,
    attempt: number = 1
  ): Promise<void> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Reverse geocode HTTP ${response.status}`);
      }

      const data = await response.json();
      const displayAddress =
        data?.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

      const emergencyRef = doc(this.db, 'emergencies', emergencyId);
      await updateDoc(emergencyRef, { displayAddress });

      console.log('Display address saved:', displayAddress);
    } catch (error) {
      console.warn(`Reverse geocoding failed (attempt ${attempt}):`, error);

      if (attempt === 1) {
        console.log('Retrying reverse geocode in 10 s...');
        setTimeout(
          () => this.reverseGeocodeAndSave(emergencyId, latitude, longitude, 2),
          10_000
        );
      }
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateETA(distanceKm: number): number {
    const averageSpeed = 30;
    const timeHours = distanceKm / averageSpeed;
    const timeMinutes = Math.round(timeHours * 60);
    return Math.max(timeMinutes, 2);
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}