import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, LoadingController } from '@ionic/angular';
import * as L from 'leaflet';
import 'leaflet-routing-machine';
import { Subscription } from 'rxjs';
import { EmergencyService } from '../../../core/services/emergency.service';

// Reuse default leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  iconUrl: 'assets/leaflet/marker-icon.png',
  shadowUrl: 'assets/leaflet/marker-shadow.png',
});

@Component({
  selector: 'app-patient-map',
  templateUrl: './patient-map.page.html',
  styleUrls: ['./patient-map.page.scss'],
  standalone: false,
})
export class PatientMapPage implements OnInit, OnDestroy {
  @ViewChild('map', { static: false }) mapElement!: ElementRef;
  
  startNavigation: () => void = () => {};
  openExternalNavigation: () => void = () => {};

  emergencyId: string | null = null;
  responderName = 'Responder';
  patientName = 'You';

  private map!: L.Map;
  private patientMarker?: L.Marker;
  private responderMarker?: L.Marker;
  private emergencySub?: Subscription;
  private routingControl: any;
  private updateInterval: any;

  mapAvailable = true;
  responderDistance = '';
  estimatedArrivalTime = '';
  
  private patientLat: number | undefined;
  private patientLng: number | undefined;
  private responderLat: number | undefined;
  private responderLng: number | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private emergencyService: EmergencyService,
    private modalController: ModalController,
    private loadingController: LoadingController
  ) {
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras.state as any;
    if (state?.emergencyId) {
      this.emergencyId = state.emergencyId;
    }
    if (state?.responderName) {
      this.responderName = state.responderName;
    }
  }

  async ngOnInit() {
    if (!this.emergencyId) {
      // Fallback: try route param
      this.emergencyId = this.route.snapshot.paramMap.get('id');
    }

    setTimeout(() => this.initMap(), 1000);

    if (this.emergencyId) {
      // Subscribe to real-time emergency updates
      this.emergencySub = this.emergencyService.userEmergency$.subscribe(emergency => {
        if (!emergency || emergency.id !== this.emergencyId) {
          return;
        }

        // Update names
        this.patientName = emergency.userName || 'You';
        if (emergency.responderName) {
          this.responderName = emergency.responderName;
        }

        // Update patient location
        if (emergency.location) {
          this.patientLat = emergency.location.latitude;
          this.patientLng = emergency.location.longitude;
        }

        // Update responder location (critical for tracking)
        if (emergency.responderLocation) {
          this.responderLat = emergency.responderLocation.latitude;
          this.responderLng = emergency.responderLocation.longitude;
        }

        // Update markers with real-time locations
        this.updateMarkers(
          { latitude: this.patientLat, longitude: this.patientLng },
          { latitude: this.responderLat, longitude: this.responderLng }
        );

        // Update distance and ETA if both locations are available
        if (this.responderLat !== undefined && this.responderLng !== undefined) {
          this.updateDistanceAndEta();
        }
      });

      // Set up periodic updates for distance and ETA calculations (every 5 seconds)
      this.updateInterval = setInterval(() => {
        this.updateDistanceAndEta();
      }, 5000);
    }
  }

  ngOnDestroy() {
    if (this.emergencySub) {
      this.emergencySub.unsubscribe();
    }
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.routingControl && this.map) {
      this.map.removeControl(this.routingControl);
    }
    if (this.map) {
      this.map.remove();
    }
  }

  private async initMap() {
    const loading = await this.loadingController.create({ message: 'Loading map...' });
    await loading.present();

    try {
      if (!this.mapElement || !this.mapElement.nativeElement) {
        await loading.dismiss();
        this.mapAvailable = false;
        return;
      }

      // Try to load initial emergency data first
      if (this.emergencyId) {
        try {
          const emergency = await this.emergencyService.getEmergencyById(this.emergencyId);
          if (emergency && emergency.location) {
            this.patientLat = emergency.location.latitude;
            this.patientLng = emergency.location.longitude;
            this.responderName = emergency.responderName || 'Responder';
            this.patientName = emergency.userName || 'You';
            
            if (emergency.responderLocation) {
              this.responderLat = emergency.responderLocation.latitude;
              this.responderLng = emergency.responderLocation.longitude;
            }
          }
        } catch (e) {
          console.warn('Could not load initial emergency data:', e);
        }
      }

      // If we don't have patient location, show fallback
      if (typeof this.patientLat === 'undefined' || typeof this.patientLng === 'undefined') {
        await loading.dismiss();
        this.mapAvailable = false;
        return;
      }

      // Initialize the map centered on patient location
      this.map = L.map(this.mapElement.nativeElement, {
        center: [this.patientLat, this.patientLng],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(this.map);

      // Set up navigation functions after map is ready
      this.setupNavigationFunctions();

      // Update markers with initial data
      this.updateMarkers(
        { latitude: this.patientLat, longitude: this.patientLng },
        { latitude: this.responderLat, longitude: this.responderLng }
      );

      this.mapAvailable = true;
      console.log('Patient map initialized successfully');
    } catch (e) {
      console.error('Error initializing patient map', e);
      this.mapAvailable = false;
    } finally {
      await loading.dismiss();
    }
  }

  private updateMarkers(patientLoc?: { latitude?: number; longitude?: number }, responderLoc?: { latitude?: number; longitude?: number }) {
    if (!this.map) {
      return;
    }

    const markers: L.LatLngExpression[] = [];

    // Update patient marker (should be set once and remain constant)
    if (patientLoc && typeof patientLoc.latitude === 'number' && typeof patientLoc.longitude === 'number') {
      const latlng: L.LatLngExpression = [patientLoc.latitude, patientLoc.longitude];
      if (!this.patientMarker) {
        this.patientMarker = L.marker(latlng)
          .addTo(this.map)
          .bindPopup('Your location');
      } else {
        this.patientMarker.setLatLng(latlng);
      }
      markers.push(latlng);
    }

    // Update responder marker (should update dynamically as they move)
    if (responderLoc && typeof responderLoc.latitude === 'number' && typeof responderLoc.longitude === 'number') {
      const latlng: L.LatLngExpression = [responderLoc.latitude, responderLoc.longitude];
      if (!this.responderMarker) {
        this.responderMarker = L.marker(latlng, {
          icon: L.icon({
            iconUrl: 'assets/leaflet/marker-icon-2x.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            className: 'responder-marker',
          }),
        })
          .addTo(this.map)
          .bindPopup('Responder');
      } else {
        this.responderMarker.setLatLng(latlng);
      }
      markers.push(latlng);
    }

    // Fit map to show both markers if both are available
    if (markers.length === 1) {
      this.map.setView(markers[0], 15);
    } else if (markers.length === 2) {
      const bounds = L.latLngBounds(markers as any);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  private setupNavigationFunctions() {
    // This will be set up once we have marker locations
    this.startNavigation = () => {
      if (!this.patientMarker || !this.responderMarker) {
        console.warn('Navigation cannot start: missing patient or responder location');
        return;
      }

      const responderLatLng = this.responderMarker.getLatLng();
      const patientLatLng = this.patientMarker.getLatLng();

      const Routing = (L as any).Routing || (window as any).L?.Routing;
      if (typeof Routing !== 'undefined') {
        // Remove any existing routing controls
        if (this.routingControl && this.map) {
          this.map.removeControl(this.routingControl);
        }
        // @ts-ignore
        this.routingControl = Routing.control({
          waypoints: [
            responderLatLng,
            patientLatLng
          ],
          routeWhileDragging: false,
          show: true,
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: true,
          createMarker: function(i: any, wp: any, nWps: any) {
            if (i === 0) {
              return L.marker(wp.latLng, { 
                icon: L.icon({ 
                  iconUrl: 'assets/leaflet/marker-icon-2x.png', 
                  iconSize: [25, 41], 
                  iconAnchor: [12, 41], 
                  className: 'responder-marker' 
                }) 
              });
            } else {
              return L.marker(wp.latLng, { 
                icon: L.icon({ 
                  iconUrl: 'assets/leaflet/marker-icon.png', 
                  iconSize: [25, 41], 
                  iconAnchor: [12, 41] 
                }) 
              });
            }
          }
        }).addTo(this.map);
      } else {
        console.warn('Leaflet routing not available');
      }
    };

    this.openExternalNavigation = () => {
      if (!this.patientMarker || !this.responderMarker) {
        console.warn('Cannot open external navigation: missing patient or responder location');
        return;
      }

      const responderLatLng = this.responderMarker.getLatLng();
      const patientLatLng = this.patientMarker.getLatLng();

      const url = `https://www.google.com/maps/dir/?api=1&origin=${responderLatLng.lat},${responderLatLng.lng}&destination=${patientLatLng.lat},${patientLatLng.lng}&travelmode=driving`;
      window.open(url, '_blank');
    };
  }

  private updateDistanceAndEta() {
    // Calculate distance between responder and patient using Haversine formula
    if (
      typeof this.responderLat === 'number' && typeof this.responderLng === 'number' &&
      typeof this.patientLat === 'number' && typeof this.patientLng === 'number'
    ) {
      const toRad = (value: number) => value * Math.PI / 180;
      const R = 6371; // Earth radius in km
      const dLat = toRad(this.patientLat - this.responderLat);
      const dLng = toRad(this.patientLng - this.responderLng);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(this.responderLat)) * Math.cos(toRad(this.patientLat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      this.responderDistance = `${distance.toFixed(2)} km`;
      
      // ETA calculation (assume average speed 40 km/h)
      const speed = 40; // km/h
      const etaMinutes = distance > 0 ? Math.ceil((distance / speed) * 60) : 0;
      this.estimatedArrivalTime = etaMinutes > 0 ? `${etaMinutes} min` : 'Arriving now';
      
      console.log(`Responder Distance: ${this.responderDistance}, ETA: ${this.estimatedArrivalTime}`);
    } else {
      this.responderDistance = 'Locating...';
      this.estimatedArrivalTime = 'Calculating...';
    }
  }

  async close() {
    const topModal = await this.modalController.getTop();
    if (topModal) {
      await this.modalController.dismiss();
      return;
    }
    this.router.navigate(['/tabs/home']);
  }
}
