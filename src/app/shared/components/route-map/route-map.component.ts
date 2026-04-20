import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import * as L from 'leaflet';
import { EmergencyService } from '../../../core/services/emergency.service';
import { onSnapshot, doc, getFirestore } from 'firebase/firestore';

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
});

export interface RouteData {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  buddyName: string;
  patientName: string;
}

@Component({
  selector: 'app-route-map',
  templateUrl: './route-map.component.html',
  styleUrls: ['./route-map.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class RouteMapComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;
  @Input() routeData!: RouteData;
  @Input() emergencyId?: string;
  @Input() buddyId?: string;

  map!: L.Map;
  estimatedTime: string = 'Calculating...';
  distance: string = 'Calculating...';
  mapAvailable: boolean = true; // Leaflet is always available
  private updateInterval: any;
  private buddyMarker?: L.Marker;
  private emergencySubscription: any;
  private db = getFirestore();

  constructor(
    private modalController: ModalController,
    private emergencyService: EmergencyService
  ) {}

  ngOnInit() {
    console.log('RouteMapComponent: Initializing with route data:', this.routeData);
    
    // Validate route data
    if (!this.routeData) {
      console.error('No route data provided');
      this.mapAvailable = false;
      this.showFallbackMap();
      return;
    }
    
    if (!this.isValidCoordinate(this.routeData.origin) || !this.isValidCoordinate(this.routeData.destination)) {
      console.warn('Invalid coordinates detected, using fallback');
      this.mapAvailable = false;
      this.showFallbackMap();
      return;
    }
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      this.initializeLeafletMap();
      // Start live tracking if emergencyId and buddyId are provided
      if (this.emergencyId && this.buddyId) {
        this.startLiveTracking();
      }
    }, 100);
  }
  
  private initializeLeafletMap() {
    if (!this.mapContainer) {
      setTimeout(() => this.initializeLeafletMap(), 100);
      return;
    }

    try {
      console.log('Initializing Leaflet map...');

      // Initialize map centered between origin and destination
      const center: [number, number] = [
        (this.routeData.origin.lat + this.routeData.destination.lat) / 2,
        (this.routeData.origin.lng + this.routeData.destination.lng) / 2
      ];

      this.map = L.map(this.mapContainer.nativeElement, {
        center: center,
        zoom: 13,
        zoomControl: true,
        attributionControl: true
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(this.map);

      // Add markers for origin and destination
      this.buddyMarker = L.marker([this.routeData.origin.lat, this.routeData.origin.lng])
        .addTo(this.map)
        .bindPopup(`${this.routeData.buddyName} (Current Location)`);

      const destinationMarker = L.marker([this.routeData.destination.lat, this.routeData.destination.lng])
        .addTo(this.map)
        .bindPopup(`${this.routeData.patientName} (Destination)`);

      // Add a simple line between the points (initial route)
      const routeLine = L.polyline([
        [this.routeData.origin.lat, this.routeData.origin.lng],
        [this.routeData.destination.lat, this.routeData.destination.lng]
      ], {
        color: '#2dd36f',
        weight: 4,
        opacity: 0.8
      }).addTo(this.map);

      // Fit map to show both markers
      const group = L.featureGroup([this.buddyMarker, destinationMarker, routeLine]);
      this.map.fitBounds(group.getBounds(), { padding: [20, 20] });

      // Calculate basic distance and time
      this.calculateRouteInfo();

      console.log('Leaflet map initialized successfully');
      
    } catch (error) {
      console.error('Error initializing Leaflet map:', error);
      this.mapAvailable = false;
      this.showFallbackMap();
    }
  }

  private calculateRouteInfo() {
    const distance = this.calculateDistance(
      this.routeData.origin.lat,
      this.routeData.origin.lng,
      this.routeData.destination.lat,
      this.routeData.destination.lng
    );
    
    this.distance = `${distance.toFixed(1)} km`;
    this.estimatedTime = `${Math.ceil(distance * 2)} min`; // Rough estimate: 2 min per km
    
    console.log('Route calculated - Distance:', this.distance, 'Time:', this.estimatedTime);
  }

  private isValidCoordinate(coord: { lat: number; lng: number }): boolean {
    return coord && 
           typeof coord.lat === 'number' && 
           typeof coord.lng === 'number' &&
           coord.lat !== 0 && 
           coord.lng !== 0 &&
           Math.abs(coord.lat) <= 90 && 
           Math.abs(coord.lng) <= 180;
  }

  ngOnDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.emergencySubscription) {
      this.emergencySubscription();
    }
    if (this.map) {
      this.map.remove();
    }
  }

  /**
   * Start listening for live location updates from Firebase
   */
  private startLiveTracking() {
    if (!this.emergencyId) {
      console.warn('No emergencyId provided for live tracking');
      return;
    }

    const emergencyRef = doc(this.db, 'emergencies', this.emergencyId);
    
    this.emergencySubscription = onSnapshot(emergencyRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        
        // Check if there's updated responder location
        if (data['responderLocation']) {
          const newLocation = data['responderLocation'];
          
          if (this.isValidCoordinate({ lat: newLocation.latitude, lng: newLocation.longitude })) {
            console.log('Live location update received:', newLocation);
            this.updateBuddyMarker(newLocation.latitude, newLocation.longitude);
            this.updateRouteInfo(newLocation);
          }
        }
      }
    }, (error) => {
      console.error('Live tracking error:', error);
    });

    console.log('Live tracking started for emergency:', this.emergencyId);
  }

  /**
   * Update buddy marker position on the map
   */
  private updateBuddyMarker(lat: number, lng: number) {
    if (this.buddyMarker && this.map) {
      this.buddyMarker.setLatLng([lat, lng]);
      
      // Optional: animate the map to follow the buddy
      // this.map.setView([lat, lng], this.map.getZoom());
      
      // Update the popup content to show it's the current location
      this.buddyMarker.bindPopup(`${this.routeData.buddyName} (Live Location)`);
    }
  }

  /**
   * Update route information based on new buddy location
   */
  private updateRouteInfo(newLocation: { latitude: number; longitude: number }) {
    if (this.routeData?.destination) {
      const distance = this.calculateDistance(
        newLocation.latitude,
        newLocation.longitude,
        this.routeData.destination.lat,
        this.routeData.destination.lng
      );

      const estimatedMinutes = Math.ceil(distance * 2); // Rough estimate
      
      this.distance = `${distance.toFixed(1)} km`;
      this.estimatedTime = `${estimatedMinutes} minutes`;
    }
  }

  private showFallbackMap() {
    console.log('Showing fallback map');
    
    // Check if we have valid coordinates for calculation
    if (this.isValidCoordinate(this.routeData?.origin) && this.isValidCoordinate(this.routeData?.destination)) {
      // Calculate basic distance and time estimate
      const distance = this.calculateDistance(
        this.routeData.origin.lat,
        this.routeData.origin.lng,
        this.routeData.destination.lat,
        this.routeData.destination.lng
      );
      
      this.distance = `${distance.toFixed(1)} km`;
      this.estimatedTime = `${Math.ceil(distance * 2)} minutes`; // Rough estimate
    } else {
      // No valid coordinates available
      this.distance = 'Unable to calculate';
      this.estimatedTime = 'Unable to calculate';
      console.warn('[WARNING] Invalid coordinates - cannot calculate distance');
    }
    
    console.log('Fallback map with distance:', this.distance, 'time:', this.estimatedTime);
  }

  private showFallbackInfo() {
    // Calculate rough distance as fallback
    const distance = this.calculateDistance(
      this.routeData.origin.lat,
      this.routeData.origin.lng,
      this.routeData.destination.lat,
      this.routeData.destination.lng
    );
    
    this.distance = `~${distance.toFixed(1)} km`;
    this.estimatedTime = `~${Math.ceil(distance * 2)} minutes`; // Rough estimate
  }

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

  openInMapsApp() {
    const url = `https://www.google.com/maps/dir/${this.routeData.origin.lat},${this.routeData.origin.lng}/${this.routeData.destination.lat},${this.routeData.destination.lng}`;
    window.open(url, '_system');
  }

  async dismiss() {
    await this.modalController.dismiss();
  }
}