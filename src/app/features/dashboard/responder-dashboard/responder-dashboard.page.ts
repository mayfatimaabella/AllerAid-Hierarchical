import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, Input } from '@angular/core';
import { ModalController, NavController, AlertController, ToastController } from '@ionic/angular';
import { AllergyService } from '../../../core/services/allergy.service';
import { MedicalService } from '../../../core/services/medical.service';
import * as L from 'leaflet';
import 'leaflet-routing-machine';
import { Router } from '@angular/router';
import { BuddyService } from '../../../core/services/buddy.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { EmergencyService, EmergencyAlert } from '../../../core/services/emergency.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-responder-dashboard',
  templateUrl: './responder-dashboard.page.html',
  styleUrls: ['./responder-dashboard.page.scss'],
  standalone: false,
})
export class ResponderDashboardPage implements OnInit, AfterViewInit, OnDestroy {
  @Input() responderData: any;
  @ViewChild('miniMap', { static: false }) miniMapElement!: ElementRef;
  
  // State Variables
  estimatedArrival: string = 'Calculating...';
  emergencyAllergies: any[] = [];
  isAllergiesLoading: boolean = true;
  isAddressLoading: boolean = true;
  address: string = '';
  patientAddress: string = '';
  responderAddress: string = '';
  isResponderAddressLoading: boolean = false;
  hasResponded: boolean = false;
  emergencyContactPhone: string | null = null;
  formattedDateOfBirth: string = 'Not specified';
  bloodType: string | null = null;
  
  activeEmergencies: EmergencyAlert[] = [];
  currentEmergency: EmergencyAlert | null = null;

  // Patient Details
  patientAvatar: string | null = null;
  specificInstructionEntries: { label: string; text: string }[] = [];
  private profileInstructionFallback = '';
  
  // Leaflet Objects
  private miniMap!: L.Map;
  private routingControl: any;

  // Subscriptions
  private emergencySubscription: Subscription | null = null;
  private instructionFallbackByUserId = new Map<string, string>();
  private avatarByUserId = new Map<string, string>();

  constructor(
    private router: Router,
    private buddyService: BuddyService,
    private authService: AuthService,
    private userService: UserService,
    private emergencyService: EmergencyService,
    private allergyService: AllergyService,
    private medicalService: MedicalService,
    private modalController: ModalController,
    private navCtrl: NavController,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    if (!this.responderData) {
      const navState = history.state;
      if (navState?.emergencyData) {
        this.responderData = navState.emergencyData;
      }
    }

    await this.setupRealTimeListeners();

    if (this.responderData && this.responderData.alert) {
      this.currentEmergency = {
        id: this.responderData.emergencyId || this.responderData.alert.id,
        userId: this.responderData.alert.userId,
        userName: this.responderData.userName || this.responderData.alert.userName,
        location: this.responderData.alert.location,
        status: this.responderData.alert.status,
        timestamp: this.responderData.alert.timestamp
      } as EmergencyAlert;

      await this.loadProfileInstructionFallback(this.currentEmergency.userId);
      if (this.currentEmergency?.location) {
        await this.fetchAddressFromCoords(this.currentEmergency.location.latitude, this.currentEmergency.location.longitude);
      }
    }
  }

  ngAfterViewInit() {
    if (this.currentEmergency) {
      this.loadMiniMap();
    }
  }

  ngOnDestroy() {
    if (this.emergencySubscription) {
      this.emergencySubscription.unsubscribe();
    }
    if (this.miniMap) {
      this.miniMap.remove();
    }
  }

  private loadMiniMap() {
    setTimeout(() => {
      if (this.currentEmergency?.location && this.miniMapElement) {
        const { latitude, longitude } = this.currentEmergency.location;
      
        if (this.miniMap) {
          this.miniMap.remove();
        }

        this.miniMap = L.map(this.miniMapElement.nativeElement, {
          center: [latitude, longitude],
          zoom: 15,
          zoomControl: false, 
          attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.miniMap);

        L.marker([latitude, longitude], { 
          icon: L.icon({ iconUrl: 'assets/leaflet/marker-icon.png', iconSize: [25, 41], iconAnchor: [12, 41] }) 
        }).addTo(this.miniMap).bindPopup('Patient');

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(position => {
            const resLat = position.coords.latitude;
            const resLng = position.coords.longitude;
            
            // Add Responder Marker
            L.marker([resLat, resLng], { 
              icon: L.icon({ iconUrl: 'assets/leaflet/marker-icon-2x.png', iconSize: [25, 41], iconAnchor: [12, 41] }) 
            }).addTo(this.miniMap).bindPopup('You');

            this.startAutomaticRouting(resLat, resLng, latitude, longitude);
            this.fetchResponderAddress(resLat, resLng);
          });
        }

        this.fetchAddressFromCoords(latitude, longitude);
      }
    }, 500);
  }

  private startAutomaticRouting(resLat: number, resLng: number, patLat: number, patLng: number) {
    if (this.routingControl) {
      this.miniMap.removeControl(this.routingControl);
    }

    this.routingControl = (L as any).Routing.control({
      waypoints: [
        L.latLng(resLat, resLng),
        L.latLng(patLat, patLng)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      show: false, 
      createMarker: () => null 
    }).addTo(this.miniMap);

    this.routingControl.on('routesfound', (e: any) => {
    const routes = e.routes;
    const summary = routes[0].summary;
    
    // summary.totalTime is in seconds; convert to minutes
    const travelTimeMinutes = Math.round(summary.totalTime / 60);
    
    if (travelTimeMinutes < 1) {
      this.estimatedArrival = 'Arriving now';
    } else {
      this.estimatedArrival = `${travelTimeMinutes} minutes away`;
    }
  });
  }
  

  resetMiniMapView() {
    if (this.miniMap && this.currentEmergency?.location) {
      const { latitude, longitude } = this.currentEmergency.location;
      this.miniMap.setView([latitude, longitude], 15);
    }
  }

  openGoogleMaps() {
    if (this.currentEmergency?.location) {
      const lat = this.currentEmergency.location.latitude;
      const lng = this.currentEmergency.location.longitude;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
      window.open(url, '_system');
    }
  }

  async confirmHelpCompleted() {
    const alert = await this.alertController.create({
      header: 'Emergency Resolved',
      subHeader: 'Patient Status Report',
      message: 'Please provide a quick status of the patient.',
      cssClass: 'custom-emergency-alert',
      inputs: [
        {
          name: 'status',
        type: 'radio', // Changed to radio for faster selection
        label: 'Stable / OK',
        value: 'stable',
        checked: true
      },
      {
        name: 'status',
        type: 'radio',
        label: 'Needs Medical Assistance',
        value: 'needs_ems'
      },
      {
        name: 'status',
        type: 'radio',
        label: 'Unconscious',
        value: 'unconscious'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Submit & Finish',
          cssClass: 'submit-button',
          handler: async (data) => {
            if (this.currentEmergency?.id) {
              await this.emergencyService.resolveEmergency(this.currentEmergency.id);
              this.currentEmergency = null;
              this.hasResponded = false;
              const modal = await this.modalController.getTop();
              if (modal) {
                await modal.dismiss(null, 'completed');
              } else {
                await this.navCtrl.navigateRoot(['/tabs/home'], { replaceUrl: true });
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async setupRealTimeListeners() {
    try {
      const user = await this.authService.waitForAuthInit();
      if (user) {
        this.buddyService.listenForEmergencyAlerts(user.uid);
        this.emergencySubscription = this.buddyService.activeEmergencyAlerts$.subscribe(async alerts => {
          this.activeEmergencies = alerts.filter(alert => alert.status === 'active' || alert.status === 'responding');

          if (this.activeEmergencies.length > 0) {
            const nextEmergency = this.activeEmergencies[0];
            if (!nextEmergency || !nextEmergency.userId) {
              this.currentEmergency = null;
              return;
            }

            this.currentEmergency = nextEmergency;
            await this.loadProfileInstructionFallback(nextEmergency.userId);
            this.loadMiniMap();
            
            if (nextEmergency.userId) {
              this.isAllergiesLoading = true;
              const allergies = await this.allergyService.getUserAllergies(nextEmergency.userId);
              this.emergencyAllergies = allergies ? allergies.filter((a: any) => a.checked) : [];

              const emergencyInstructions = await this.medicalService.getEmergencyInstructions(nextEmergency.userId);
              this.specificInstructionEntries = (emergencyInstructions || [])
                .filter((entry: any) => entry?.allergyName && entry?.instruction)
                .map((entry: any) => ({ label: entry.allergyName, text: entry.instruction }));
              this.isAllergiesLoading = false;
            }
          } else {
            this.currentEmergency = null;
          }
        });
      }
    } catch (error) {
      console.error('Error setting up listeners:', error);
    }
  }

  private async fetchAddressFromCoords(lat: number, lng: number) {
    try {
      this.isAddressLoading = true;
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const response = await fetch(url);
      const data = await response.json();
      this.address = data?.display_name || 'Location unavailable';
      this.patientAddress = this.address;
    } catch (e) {
      this.patientAddress = 'Location unavailable';
    } finally {
      this.isAddressLoading = false;
    }
  }

  private async fetchResponderAddress(lat: number, lng: number) {
    try {
      this.isResponderAddressLoading = true;
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const response = await fetch(url);
      const data = await response.json();
      this.responderAddress = data?.display_name || 'Location unavailable';
    } catch (e) {
      this.responderAddress = 'Location unavailable';
    } finally {
      this.isResponderAddressLoading = false;
    }
  }

  private async loadProfileInstructionFallback(userId?: string): Promise<void> {
    if (!userId) return;
    try {
      const profile = await this.userService.getUserProfile(userId);
      this.profileInstructionFallback = (profile as any)?.emergencyMessage?.instructions || (profile as any)?.emergencyInstruction || '';
      const rawAvatar = (profile as any)?.avatar;
      this.patientAvatar = (typeof rawAvatar === 'string' && rawAvatar.trim().length > 0) ? rawAvatar.trim() : null;

      // Patient identity details for responder view
      this.emergencyContactPhone = (profile as any)?.emergencyContactPhone || null;
      const dob = (profile as any)?.dateOfBirth;
      if (dob) {
        const date = new Date(dob);
        this.formattedDateOfBirth = isNaN(date.getTime()) ? dob : date.toLocaleDateString();
      } else {
        this.formattedDateOfBirth = 'Not specified';
      }
      this.bloodType = (profile as any)?.bloodType || null;
    } catch (error) {
      console.warn('Unable to load profile instructions:', error);
    }
  }

  get profileEmergencyInstruction(): string { return this.profileInstructionFallback; }
  get hasEmergencyInstruction(): boolean { return !!(this.eventSpecificInstruction || this.profileEmergencyInstruction); }
  get eventSpecificInstruction(): string { return (this.currentEmergency as any)?.emergencyInstruction || ''; }
  get displayedEmergencyInstruction(): string { return this.eventSpecificInstruction || this.profileEmergencyInstruction || 'No instructions available'; }

  speakAlert() {
    if (!this.currentEmergency) return;
    const text = `Emergency alert from ${this.currentEmergency.userName}. ${this.displayedEmergencyInstruction}. Patient location is ${this.address}.`;

    // Safely use Web Speech API only when fully supported
    if (typeof window === 'undefined') {
      console.warn('Text-to-speech not available: window is undefined');
      return;
    }

    const hasSpeechSynthesis = 'speechSynthesis' in window;
    const hasUtteranceConstructor = typeof SpeechSynthesisUtterance !== 'undefined';

    if (!hasSpeechSynthesis || !hasUtteranceConstructor) {
      console.warn('Text-to-speech not supported on this device');
      return;
    }

    // Stop any ongoing speech before starting a new one
    window.speechSynthesis.cancel();

    const message = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(message);
  }

  async acceptEmergency() {
    try {
      if (this.currentEmergency?.id) {
        const user = await this.authService.waitForAuthInit();
        if (user) {
          // Get responder profile for their name
          const userProfile = await this.userService.getUserProfile(user.uid);
          const responderName = userProfile
            ? `${(userProfile as any).firstName || ''} ${(userProfile as any).lastName || ''}`.trim() || 'Responder'
            : 'Responder';

          // Respond to the emergency - this will notify the patient automatically
          await this.emergencyService.respondToEmergency(
            this.currentEmergency.id,
            user.uid,
            responderName
          );

          // Update UI state
          this.hasResponded = true;
        }
      }
    } catch (error) {
      console.error('Error accepting emergency:', error);
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Failed to accept emergency. Please try again.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async cannotRespond() {
    const alert = await this.alertController.create({
      header: 'Decline Emergency',
      message: 'Are you sure you cannot respond to this emergency?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Decline',
          handler: async () => {
            try {
              if (this.currentEmergency?.id) {
                const user = await this.authService.waitForAuthInit();
                if (user) {
                  // Resolve buddy name from profile so the patient sees who cannot respond
                  const userProfile = await this.userService.getUserProfile(user.uid);
                  const buddyName = userProfile
                    ? `${(userProfile as any).firstName || ''} ${(userProfile as any).lastName || ''}`.trim() || 'Buddy'
                    : 'Buddy';

                  await this.emergencyService.recordBuddyCannotRespond(
                    this.currentEmergency.id,
                    user.uid,
                    buddyName
                  );

                  // Mark this emergency as dismissed for this buddy and
                  // save a snapshot so it appears in the Emergencies history.
                  this.buddyService.dismissEmergencyForUser(user.uid, this.currentEmergency.id);
                  this.buddyService.saveDismissedAlertData(user.uid, this.currentEmergency as any);

                  // Update UI state to hide buttons
                  this.hasResponded = true;
                }
              }
            } catch (error) {
              console.error('Error declining:', error);
            } finally {
              const modal = await this.modalController.getTop();
              if (modal) {
                await modal.dismiss(null, 'cancel');
              } else {
                await this.navCtrl.navigateRoot(['/tabs/home'], { replaceUrl: true });
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  viewPatients() { this.router.navigate(['/tabs/patients']); }
}