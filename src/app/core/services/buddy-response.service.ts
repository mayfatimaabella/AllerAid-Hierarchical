import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { BuddyResponseAlertComponent, BuddyResponseData } from '../../shared/components/buddy-response-alert/buddy-response-alert.component';
import { RouteMapComponent, RouteData } from '../../shared/components/route-map/route-map.component';
import { EmergencyService } from './emergency.service';
import { BuddyService } from './buddy.service';
import { LocationPermissionService } from './location-permission.service';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface LocationUpdate {
  buddyId: string;
  emergencyId: string;
  location: LocationCoords;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class BuddyResponseService {
  private locationWatchId: number | null = null;
  private isTracking = false;

  constructor(
    private modalController: ModalController,
    private emergencyService: EmergencyService,
    private buddyService: BuddyService,
    private locationPermissionService: LocationPermissionService
  ) {}

  /**
   * Handle buddy clicking "I'm on my way" button
   */
  async handleBuddyResponse(emergency: any, buddyName: string, buddyId: string): Promise<void> {
    try {
      console.log('Buddy responding to emergency:', emergency.id);
      
      // Update emergency status through the emergency service
      // This will trigger the real-time listener that patients are subscribed to
      await this.emergencyService.respondToEmergency(
        emergency.id,
        buddyId,
        buddyName
      );

      console.log('Emergency response recorded, patient will be notified automatically');

      // Get current buddy location
      const buddyLocation = await this.getCurrentLocation();
      
      // Start live location tracking
      await this.startLiveTracking(emergency.id, buddyId);
      
      // Show route map to buddy
      await this.showRouteMapToBuddy(emergency, buddyName, buddyId, buddyLocation);

      console.log('Buddy response handling complete with live tracking started');

    } catch (error) {
      console.error('Error handling buddy response:', error);
      throw error;
    }
  }

  /**
   * Get current location using browser geolocation API
   */
  private async getCurrentLocation(): Promise<LocationCoords> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Fallback to approximate location or ask user
          reject(new Error('Unable to get current location'));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  }

  /**
   * Start live location tracking for buddy
   */
  async startLiveTracking(emergencyId: string, buddyId: string): Promise<void> {
    if (this.isTracking) {
      console.log('Live tracking already active, stopping previous tracking');
      this.stopLiveTracking();
    }

    // Check and request location permissions
    const permissionResult = await this.locationPermissionService.requestLocationPermissions();
    if (!permissionResult.granted) {
      console.error('Location permission denied:', permissionResult.message);
      await this.locationPermissionService.showLocationRequiredToast();
      return;
    }

    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    this.isTracking = true;

    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 5000 // Allow cached positions up to 5 seconds
    };

    this.locationWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        if (!this.isTracking) return;

        const locationUpdate: LocationUpdate = {
          buddyId: buddyId,
          emergencyId: emergencyId,
          location: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          },
          timestamp: new Date()
        };

        try {
          // Update buddy location in emergency document
          await this.emergencyService.updateResponderLocation(
            emergencyId,
            buddyId,
            {
              latitude: locationUpdate.location.latitude,
              longitude: locationUpdate.location.longitude
            }
          );

          console.log('Live location updated:', locationUpdate.location);
        } catch (error) {
          console.error('Error updating live location:', error);
        }
      },
      (error) => {
        console.error('Live tracking error:', error);
        // Don't stop tracking on errors, geolocation can be intermittent
      },
      options
    );

    console.log('Live location tracking started for buddy:', buddyId);
  }

  /**
   * Stop live location tracking
   */
  stopLiveTracking(): void {
    if (this.locationWatchId !== null) {
      navigator.geolocation.clearWatch(this.locationWatchId);
      this.locationWatchId = null;
    }
    this.isTracking = false;
    console.log('Live location tracking stopped');
  }

  /**
   * Calculate route information between two points
   */
  private async calculateRouteInfo(origin: LocationCoords, destination: any): Promise<{
    distance: string;
    estimatedTime: string;
  }> {
    try {
      // Calculate straight-line distance as fallback
      const distance = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );

      // Rough time estimate (assuming average city driving speed)
      const estimatedMinutes = Math.ceil(distance * 2); // ~30 km/h average

      return {
        distance: `${distance.toFixed(1)} km`,
        estimatedTime: `${estimatedMinutes} minutes`
      };
    } catch (error) {
      console.error('Error calculating route:', error);
      return {
        distance: 'Calculating...',
        estimatedTime: 'Calculating...'
      };
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * Show route map to buddy
   */
  private async showRouteMapToBuddy(emergency: any, buddyName: string, buddyId: string, buddyLocation: LocationCoords): Promise<void> {
    const routeData: RouteData = {
      origin: { lat: buddyLocation.latitude, lng: buddyLocation.longitude },
      destination: { lat: emergency.location.latitude, lng: emergency.location.longitude },
      buddyName: buddyName,
      patientName: emergency.userName || emergency.patientName
    };

    const modal = await this.modalController.create({
      component: RouteMapComponent,
      componentProps: {
        routeData: routeData,
        emergencyId: emergency.id,
        buddyId: buddyId
      },
      cssClass: 'route-map-modal'
    });

    await modal.present();
  }
}