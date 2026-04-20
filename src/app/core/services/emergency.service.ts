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
  timestamp: any; // Firestore Timestamp
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  responderLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  allergies?: string[];
  instruction?: string;
  emergencyInstruction?: string;
  status: 'active' | 'responding' | 'resolved';
  buddyIds: string[]; // IDs of buddies to notify
  responderId?: string; // ID of the buddy who is responding
  responderName?: string; // Name of the buddy who is responding
  estimatedArrival?: number; // Minutes until arrival
  responseTimestamp?: any; // When responder clicked "on my way"
  distance?: number; // Distance in kilometers
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
  private locationWatchId: string | null = null;
  
  // Observable for tracking emergency alerts that the current user initiated
  private userEmergencySubject = new BehaviorSubject<EmergencyAlert | null>(null);
  userEmergency$ = this.userEmergencySubject.asObservable();
  
  // Observable for tracking emergency responses
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
      
      // 1st Get current location with graceful fallback
      let position: Position | null = null;
      try {
        position = await this.getCurrentLocation();
      } catch (geoError) {
        // Geolocation can fail on web if not served over HTTPS or permission denied
        const code = (geoError as any)?.code;
        console.warn('Geolocation unavailable, proceeding without precise location.', {
          code,
          message: (geoError as any)?.message || String(geoError)
        });
      }
      
      // Create the emergency alert
      // Build location object safely (avoid undefined fields for Firestore)
      const location = position ? {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        ...(position.coords.accuracy !== undefined ? { accuracy: position.coords.accuracy } : {})
      } : {
        latitude: 0,
        longitude: 0
      };

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
      
      // 2nd Add to Firestore
      const docRef = await addDoc(collection(this.db, 'emergencies'), emergencyData);
      const emergencyId = docRef.id;
      
      // 3rd Update the emergency data with the ID
      emergencyData.id = emergencyId;
      
      console.log('Emergency alert created in Firestore:', emergencyId);
      
      // 4th Start tracking location updates
      this.startLocationTracking(emergencyId);
      
      // 5th Set up listener for responses
      this.listenForResponses(emergencyId, userId);
      
      // AUTO EMERGENCY NOTIFICATIONS
      // Send SMS and push notifications to all buddies
      if (this.emergencyNotificationService && this.userService) {
        try {
          console.log('Sending emergency notifications to buddies...');
          
          // Get user profile for comprehensive emergency info
          const userProfile = await this.userService.getUserProfile(userId);
          
          // Send notifications to all buddies
          await this.emergencyNotificationService.sendEmergencyNotifications(
            emergencyData,
            userProfile
          );
          
          console.log('Emergency notifications sent successfully');
          
        } catch (notificationError) {
          console.error('Emergency notifications failed:', notificationError);
          // Don't throw error - emergency alert should still work even if notifications fail
        }
      } else {
        console.log('Emergency notification service not available');
      }
      
      return emergencyId;
    } catch (error) {
      console.error(' Error sending emergency alert:', error);
      throw error;
    }
  }
  
  /**
   * Get the current location
   */
  async getCurrentLocation(): Promise<Position> {
    if (Capacitor.isNativePlatform()) {
      // On mobile devices, use Capacitor Geolocation
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        throw new Error('Geolocation is not available on this device');
      }
      
      // Request location permissions
      await Geolocation.requestPermissions();
      
      console.log('Attempting to get current location...'); // Debug log
      
      try {
        // First try with high accuracy and longer timeout
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 30000, // 30 seconds
          maximumAge: 300000 // 5 minutes - accept cached location
        });
        
        console.log('Got high accuracy location:', position); // Debug log
        return position;
      } catch (highAccuracyError) {
        console.log('High accuracy failed, trying low accuracy...', highAccuracyError); // Debug log
        
        // Fallback: try with lower accuracy but faster response
        try {
          const position = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 15000, // 15 seconds
            maximumAge: 600000 // 10 minutes - accept older cached location
          });
          
          console.log('Got low accuracy location:', position); // Debug log
          return position;
        } catch (lowAccuracyError) {
          console.error('Both location attempts failed:', lowAccuracyError);
          const errorMessage = lowAccuracyError instanceof Error ? lowAccuracyError.message : 'Unknown location error';
          throw new Error(`Could not obtain location: ${errorMessage}`);
        }
      }
    } else {
      // On web, use browser's native geolocation API
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser'));
          return;
        }
        
        console.log('Attempting to get web location...'); // Debug log
        
        // First try with high accuracy
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('Got high accuracy web location:', position); // Debug log
            // Convert browser GeolocationPosition to Capacitor Position format
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
            console.log('High accuracy web location failed, trying low accuracy...', error); // Debug log
            
            // Fallback: try with lower accuracy
            navigator.geolocation.getCurrentPosition(
              (position) => {
                console.log('Got low accuracy web location:', position); // Debug log
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
                timeout: 15000, // 15 seconds
                maximumAge: 600000 // 10 minutes
              }
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 30000, // 30 seconds
            maximumAge: 300000 // 5 minutes
          }
        );
      });
    }
  }
  
  /**
   * Start tracking location and update it in Firestore
   */
  async startLocationTracking(emergencyId: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor for mobile
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        console.error('Geolocation is not available on this device');
        return;
      }
      
      try {
        // Watch position with options
        this.locationWatchId = await Geolocation.watchPosition(
          { 
            enableHighAccuracy: true, 
            timeout: 10000,
            maximumAge: 30000 // Accept location up to 30 seconds old
          },
          (position) => {
            if (position) {
              this.updateEmergencyLocation(emergencyId, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
              });
              console.log('Real-time location updated:', position.coords.latitude, position.coords.longitude, 'accuracy:', position.coords.accuracy);
            }
          }
        );
      } catch (error) {
        console.error('Error starting location tracking:', error);
      }
    } else {
      // Use browser geolocation for web
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        return;
      }
      
      // For web, we'll use setInterval to periodically get location
      const watchId = setInterval(async () => {
        try {
          const position = await this.getCurrentLocation();
          this.updateEmergencyLocation(emergencyId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
          console.log('Location updated:', position.coords.latitude, position.coords.longitude);
        } catch (error) {
          console.error('Error updating location:', error);
        }
      }, 5000); // Update every 5 seconds for more real-time tracking
      
      // Store the interval ID as a string for consistency
      this.locationWatchId = watchId.toString();
    }
  }
  
  /**
   * Stop location tracking
   */
  async stopLocationTracking(): Promise<void> {
    if (this.locationWatchId !== null) {
      if (Capacitor.isNativePlatform()) {
        // Clear Capacitor watch
        await Geolocation.clearWatch({ id: this.locationWatchId });
      } else {
        // Clear browser interval
        clearInterval(parseInt(this.locationWatchId));
      }
      this.locationWatchId = null;
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
    
    // Set up real-time listener for this emergency
    onSnapshot(emergencyRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = { id: docSnapshot.id, ...docSnapshot.data() } as EmergencyAlert;
        
        // If someone responded, update our subject
        if (data.status === 'responding' && data.responderId) {
          this.emergencyResponseSubject.next({
            responderId: data.responderId,
            responderName: data.responderName || 'A buddy',
            emergencyId: data.id,
            location: data.location
          });
        }
        
        // Update the emergency subject
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
      
      // Get current responder location
      const responderPosition = await this.getCurrentLocation();
      const responderLocation = {
        latitude: responderPosition.coords.latitude,
        longitude: responderPosition.coords.longitude,
        accuracy: responderPosition.coords.accuracy
      };
      
      // Get emergency details to calculate distance and ETA
      const emergencyDoc = await getDoc(emergencyRef);
      const emergencyData = emergencyDoc.data() as EmergencyAlert;
      
      // Calculate distance and estimated arrival time
      const distance = this.calculateDistance(
        responderLocation.latitude,
        responderLocation.longitude,
        emergencyData.location.latitude,
        emergencyData.location.longitude
      );
      
      const estimatedArrival = this.calculateETA(distance);
      
      // Update the emergency status with ETA info
      await updateDoc(emergencyRef, {
        status: 'responding',
        responderId,
        responderName,
        responderLocation,
        responseTimestamp: Timestamp.now(),
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        estimatedArrival,
        [`buddyResponses.${responderId}`]: {
          status: 'responded',
          name: responderName,
          timestamp: Timestamp.now()
        }
      });
      
      // Start tracking the responder's location
      this.startResponderLocationTracking(emergencyId, responderId);
      
      console.log(`${responderName} is responding - ETA: ${estimatedArrival} minutes, Distance: ${distance.toFixed(1)}km`);
    } catch (error) {
      console.error('Error responding to emergency:', error);
      throw error;
    }
  }
  
  /**
   * Track responder location when they respond to an emergency
   */
  async startResponderLocationTracking(emergencyId: string, responderId: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor for mobile
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        console.error('Geolocation is not available on this device');
        return;
      }
      
      try {
        // Watch position with options
        this.locationWatchId = await Geolocation.watchPosition(
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
      // Use browser geolocation for web
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported by this browser');
        return;
      }
      
      // For web, use setInterval to periodically get location
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
      }, 10000); // Update every 10 seconds
      
      // Store the interval ID as a string for consistency
      this.locationWatchId = watchId.toString();
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
      // Record this buddy's cannot-respond status
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
  async resolveEmergency(emergencyId: string): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);
      await updateDoc(emergencyRef, { status: 'resolved' });
      
      // Stop location tracking
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
    
    // Query emergencies where this buddy is in the buddyIds array and status is active
    const q = query(
      collection(this.db, 'emergencies'),
      where('buddyIds', 'array-contains', buddyId),
      where('status', 'in', ['active', 'responding'])
    );
    
    // Set up real-time listener
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
   * Get emergencies for a buddy by status (e.g. resolved, responding)
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
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  /**
   * Calculate estimated time of arrival based on distance
   */
  private calculateETA(distanceKm: number): number {
    // Assume average speed of 30 km/h in emergency situations
    // (accounts for traffic, urgency, mixed driving conditions)
    const averageSpeed = 30; // km/h
    const timeHours = distanceKm / averageSpeed;
    const timeMinutes = Math.round(timeHours * 60);
    
    // Minimum 2 minutes for very close distances
    return Math.max(timeMinutes, 2);
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

