import {Component, OnInit, OnDestroy,AfterViewInit,ViewChild,ElementRef,Input} from '@angular/core';
import {ModalController,NavController,AlertController,ToastController} from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { AllergyService } from '../../../core/services/allergy.service';
import { MedicalService } from '../../../core/services/medical.service';
import * as L from 'leaflet';
import 'leaflet-routing-machine';
import { Router } from '@angular/router';
import { BuddyService } from '../../../core/services/buddy.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { EmergencyService,} from '../../../core/services/emergency.service';
import { EmergencyAlert } from '../../../core/models/emergency-alert.model';
import { Subscription } from 'rxjs';
import { Timestamp } from 'firebase/firestore';

@Component({
  selector: 'app-responder-dashboard',
  templateUrl: './responder-dashboard.page.html',
  styleUrls: ['./responder-dashboard.page.scss'],
  standalone: false
})
export class ResponderDashboardPage implements OnInit, AfterViewInit, OnDestroy {
  @Input() responderData: any;
  @ViewChild('miniMap', { static: false }) miniMapElement?: ElementRef<HTMLDivElement>;

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

  currentUserId: string | null = null;

  patientAvatar: string | null = null;
  specificInstructionEntries: { label: string; text: string }[] = [];

  private profileInstructionFallback = '';
  private isResolving: boolean = false;
  private viewReady: boolean = false;

  private miniMap?: L.Map;
  private routingControl: any;

  private emergencySubscription: Subscription | null = null;

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
    const user = await this.authService.waitForAuthInit();
    this.currentUserId = user?.uid ?? null;

    if (!this.responderData) {
      const navState = history.state;

      if (navState?.emergencyData) {
        this.responderData = navState.emergencyData;
      }
    }

    await this.setupRealTimeListeners();

    if (this.responderData?.alert) {
      const emergency: EmergencyAlert = {
        id: this.responderData.emergencyId || this.responderData.alert.id,
        userId: this.responderData.alert.userId,
        userName: this.responderData.userName || this.responderData.alert.userName,
        buddyIds: this.responderData.alert.buddyIds || [],
        location: this.responderData.alert.location || null,
        status: this.responderData.alert.status || 'active',
        responderId: this.responderData.alert.responderId,
        responderName: this.responderData.alert.responderName,
        timestamp: this.responderData.alert.timestamp || new Date(),
        instruction: this.responderData.alert.instruction || '',
        emergencyInstruction: this.responderData.alert.emergencyInstruction ||this.responderData.alert.instruction || ''
      };

      await this.prepareEmergencyDisplay(emergency);
    }
  }

  ngAfterViewInit() {
    this.viewReady = true;

    if (this.currentEmergency) {
      this.loadMiniMap();
    }
  }

  ngOnDestroy() {
    if (this.emergencySubscription) {
      this.emergencySubscription.unsubscribe();
      this.emergencySubscription = null;
    }

    this.destroyMiniMap();
  }

  private async setupRealTimeListeners() {
    try {
      const user = await this.authService.waitForAuthInit();

      if (!user) {
        return;
      }

      if (!this.currentUserId) {
        this.currentUserId = user.uid;
      }

      this.buddyService.listenForEmergencyAlerts(user.uid);

      this.emergencySubscription = this.buddyService.activeEmergencyAlerts$.subscribe(
        async alerts => {
          this.activeEmergencies = alerts.filter(
            alert => alert.status === 'active' || alert.status === 'responding'
          );

          if (this.activeEmergencies.length > 0) {
            const nextEmergency = this.activeEmergencies[0];

            if (!nextEmergency?.userId) {
              this.currentEmergency = null;
              return;
            }

            await this.prepareEmergencyDisplay(nextEmergency);
            return;
          }

          if (!this.isResolving) {
            this.currentEmergency = null;
            await this.goHome();
          }
        }
      );
    } catch (error) {
      console.error('Error setting up listeners:', error);
    }
  }

  private async prepareEmergencyDisplay(emergency: EmergencyAlert) {
    this.currentEmergency = emergency;

    const currentUser = await this.authService.waitForAuthInit();

    if (currentUser && (emergency as any).buddyResponses) {
      const myResponse = (emergency as any).buddyResponses[currentUser.uid];

      this.hasResponded =
        myResponse?.status === 'responded' ||
        myResponse?.status === 'cannot_respond';
    } else {
      this.hasResponded = false;
    }

    await this.loadProfileInstructionFallback(emergency.userId);

    if (emergency.location?.latitude != null && emergency.location?.longitude != null) {
      await this.fetchAddressFromCoords(
        emergency.location.latitude,
        emergency.location.longitude
      );
    } else {
      this.patientAddress = '';
      this.address = '';
    }

    this.loadMiniMap();

    this.isAllergiesLoading = true;

    try {
      const allergies = await this.allergyService.getUserAllergies(emergency.userId);
      this.emergencyAllergies = allergies
        ? allergies.filter((allergy: any) => allergy.checked)
        : [];

      const emergencyInstructions =
        await this.medicalService.getEmergencyInstructions(emergency.userId);

      this.specificInstructionEntries = (emergencyInstructions || [])
        .filter((entry: any) => entry?.allergyName && entry?.instruction)
        .map((entry: any) => ({
          label: entry.allergyName,
          text: entry.instruction
        }));
    } catch (error) {
      console.warn('Unable to load allergies/instructions:', error);
      this.emergencyAllergies = [];
      this.specificInstructionEntries = [];
    } finally {
      this.isAllergiesLoading = false;
    }
  }

  private loadMiniMap() {
    setTimeout(() => {
      if (!this.viewReady) {
        return;
      }

      if (!this.currentEmergency?.location || !this.miniMapElement?.nativeElement) {
        console.warn('Mini map cannot load because emergency location or map element is missing.');
        return;
      }

      const { latitude, longitude } = this.currentEmergency.location;

      if (latitude == null || longitude == null) {
        console.warn('Mini map cannot load because latitude/longitude is missing.');
        return;
      }

      this.destroyMiniMap();

      this.miniMap = L.map(this.miniMapElement.nativeElement, {
        center: [latitude, longitude],
        zoom: 15,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
        this.miniMap
      );

      L.marker([latitude, longitude], {
        icon: L.icon({
          iconUrl: 'assets/leaflet/marker-icon.png',
          shadowUrl: 'assets/leaflet/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      })
        .addTo(this.miniMap)
        .bindPopup('Patient');

      setTimeout(() => {
        this.miniMap?.invalidateSize();
      }, 200);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => {
            const resLat = position.coords.latitude;
            const resLng = position.coords.longitude;

            if (!this.miniMap) {
              return;
            }

            L.marker([resLat, resLng], {
              icon: L.icon({
                iconUrl: 'assets/leaflet/marker-icon-2x.png',
                shadowUrl: 'assets/leaflet/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
              })
            })
              .addTo(this.miniMap)
              .bindPopup('You');

            this.fetchResponderAddress(resLat, resLng);
            this.startAutomaticRouting(resLat, resLng, latitude, longitude);
          },
          error => {
            console.warn('Unable to get responder location:', error);
            this.responderAddress = 'Location unavailable';
            this.estimatedArrival = '';
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
          }
        );
      }
    }, 500);
  }

  private destroyMiniMap() {
    if (this.routingControl && this.miniMap) {
      try {
        this.miniMap.removeControl(this.routingControl);
      } catch {
        // Ignore cleanup errors.
      }
    }

    this.routingControl = null;

    if (this.miniMap) {
      this.miniMap.remove();
      this.miniMap = undefined;
    }
  }

  private startAutomaticRouting(
    resLat: number,
    resLng: number,
    patLat: number,
    patLng: number
  ) {
    if (!this.miniMap) {
      return;
    }

    if (this.routingControl) {
      this.miniMap.removeControl(this.routingControl);
    }

    this.routingControl = (L as any).Routing.control({
      waypoints: [L.latLng(resLat, resLng), L.latLng(patLat, patLng)],
      routeWhileDragging: false,
      addWaypoints: false,
      show: false,
      createMarker: () => null
    }).addTo(this.miniMap);

    this.routingControl.on('routesfound', (event: any) => {
      const summary = event.routes?.[0]?.summary;

      if (!summary) {
        this.estimatedArrival = '';
        return;
      }

      const travelTimeMinutes = Math.round(summary.totalTime / 60);

      this.estimatedArrival =
        travelTimeMinutes < 1 ? 'Arriving now' : `${travelTimeMinutes} minutes away`;
    });

    this.routingControl.on('routingerror', (error: any) => {
      console.warn('Routing failed:', error);
      this.estimatedArrival = '';
    });
  }

  resetMiniMapView() {
    if (this.miniMap && this.currentEmergency?.location) {
      const { latitude, longitude } = this.currentEmergency.location;

      if (latitude != null && longitude != null) {
        this.miniMap.setView([latitude, longitude], 15);
        setTimeout(() => this.miniMap?.invalidateSize(), 100);
      }
    }
  }

  openGoogleMaps() {
    const lat = this.currentEmergency?.location?.latitude;
    const lng = this.currentEmergency?.location?.longitude;

    if (lat == null || lng == null) {
      console.warn('No emergency location available for Google Maps.');
      return;
    }

    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    window.open(url, '_system');
  }

  getPatientLocationText(): string {
    const lat = this.currentEmergency?.location?.latitude;
    const lng = this.currentEmergency?.location?.longitude;

    if (lat == null || lng == null) {
      return 'Location unavailable';
    }

    return `${lat}, ${lng}`;
  }

  async acceptEmergency() {
    try {
      if (!this.currentEmergency?.id) {
        return;
      }

      const user = await this.authService.waitForAuthInit();

      if (!user) {
        return;
      }

      const userProfile = await this.userService.getUserProfile(user.uid);
      const responderName = userProfile?.fullName || 'Responder';

      await this.emergencyService.respondToEmergency(
        this.currentEmergency.id,
        user.uid,
        responderName
      );

      this.hasResponded = true;
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
        {
          text: 'Decline',
          handler: async () => {
            try {
              if (!this.currentEmergency?.id) {
                return;
              }

              const user = await this.authService.waitForAuthInit();

              if (!user) {
                return;
              }

              const userProfile = await this.userService.getUserProfile(user.uid);

              const buddyName = userProfile
                ? `${(userProfile as any).firstName || ''} ${
                    (userProfile as any).lastName || ''
                  }`.trim() || 'Buddy'
                : 'Buddy';

              await this.emergencyService.recordBuddyCannotRespond(
                this.currentEmergency.id,
                user.uid,
                buddyName
              );

              this.buddyService.dismissEmergencyForUser(
                user.uid,
                this.currentEmergency.id
              );

              this.buddyService.saveDismissedAlertData(
                user.uid,
                this.currentEmergency as any
              );

              this.hasResponded = true;
            } catch (error) {
              console.error('Error declining:', error);
            } finally {
              const modal = await this.modalController.getTop();

              if (modal) {
                await modal.dismiss(null, 'cancel');
              } else {
                await this.navCtrl.navigateRoot(['/tabs/home'], {
                  replaceUrl: true
                });
              }
            }
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
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
          type: 'radio',
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
        {
          text: 'Submit & Finish',
          cssClass: 'submit-button',
          handler: async data => {
            if (!this.currentEmergency?.id || !data) {
              return;
            }

            try {
              const user = await this.authService.waitForAuthInit();

              let responderId = '';
              let responderName = 'Responder';

              if (user) {
                responderId = user.uid;

                const userProfile = await this.userService.getUserProfile(user.uid);

                responderName = userProfile
                  ? `${(userProfile as any).firstName || ''} ${
                      (userProfile as any).lastName || ''
                    }`.trim() || 'Responder'
                  : 'Responder';
              }

              await this.emergencyService.resolveEmergency(
                this.currentEmergency.id,
                data,
                responderId,
                responderName
              );

              this.isResolving = true;

              const toast = await this.toastController.create({
                message: '✓ Emergency completed — help has been delivered.',
                duration: 3000,
                color: 'success',
                position: 'top'
              });

              await toast.present();
              await toast.onDidDismiss();

              this.currentEmergency = null;
              this.hasResponded = false;
              this.isResolving = false;

              await this.navCtrl.navigateRoot(['/tabs/home'], {
                replaceUrl: true
              });

              const modal = await this.modalController.getTop();

              if (modal) {
                await modal.dismiss(null, 'completed');
              }
            } catch (error) {
              this.isResolving = false;

              console.error('Error resolving emergency:', error);

              const errorAlert = await this.alertController.create({
                header: 'Error',
                message: 'Failed to resolve emergency. Please try again.',
                buttons: ['OK']
              });

              await errorAlert.present();
            }
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  speakAlert() {
    if (!this.currentEmergency) {
      return;
    }

    const locationText =
      this.patientAddress ||
      this.address ||
      this.getPatientLocationText();

    const text = this.buildEmergencySpeechText(locationText);

    if (Capacitor.isNativePlatform()) {
      TextToSpeech.speak({
        text,
        lang: 'en-US',
        rate: 1,
        pitch: 1,
        volume: 1,
        category: 'playback',
        queueStrategy: 0
      }).catch((error: unknown) => {
        console.warn('Native TTS failed on responder dashboard:', error);
      });

      return;
    }

    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      console.warn('Text-to-speech not supported on this device');
      return;
    }

    window.speechSynthesis.cancel();

    const message = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(message);
  }

  private buildEmergencySpeechText(locationText: string): string {
    return `Emergency alert from ${this.currentEmergency?.userName || 'the patient'}. ${this.displayedEmergencyInstruction || 'No instructions available'}. Patient location is ${locationText}.`;
  }

  viewPatients() {
    this.router.navigate(['/tabs/patients']);
  }

  async goHome() {
    try {
      const modal = await this.modalController.getTop();

      if (modal) {
        await modal.dismiss(null, 'home');
      }

      const user = await this.authService.waitForAuthInit();

      if (!user) {
        await this.navCtrl.navigateRoot(['/login'], {
          replaceUrl: true
        });

        return;
      }

      const profile = await this.userService.getUserProfile(user.uid);
      const role = (profile as any)?.role;

      const roleRoutes: Record<string, string> = {
        user: '/tabs/home',
        doctor: '/tabs/doctor-dashboard',
        admin: '/tabs/admin-dashboard'
      };

      await this.navCtrl.navigateRoot([roleRoutes[role] || '/tabs/home'], {
        replaceUrl: true
      });
    } catch (error) {
      console.error('Error going home:', error);

      await this.navCtrl.navigateRoot(['/tabs/home'], {
        replaceUrl: true
      });
    }
  }

  private async fetchAddressFromCoords(lat: number, lng: number) {
    try {
      this.isAddressLoading = true;

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Reverse geocoding failed with status ${response.status}`);
      }

      const data = await response.json();
      console.log('Patient address:', data.display_name);

      this.address = data?.display_name || `${lat}, ${lng}`;
      this.patientAddress = this.address;
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);

      this.address = `${lat}, ${lng}`;
      this.patientAddress = `${lat}, ${lng}`;
    } finally {
      this.isAddressLoading = false;
    }
  }

  private async fetchResponderAddress(lat: number, lng: number) {
    try {
      this.isResponderAddressLoading = true;

      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Responder reverse geocoding failed with status ${response.status}`);
      }

      const data = await response.json();

      this.responderAddress = data?.display_name || `${lat}, ${lng}`;
    } catch (error) {
      console.warn('Responder reverse geocoding failed:', error);
      this.responderAddress = `${lat}, ${lng}`;
    } finally {
      this.isResponderAddressLoading = false;
    }
  }

  private async loadProfileInstructionFallback(userId?: string): Promise<void> {
    if (!userId) {
      return;
    }

    try {
      const completeProfile =
        await this.userService.getCompleteEmergencyProfile(userId);

      if (!completeProfile) {
        return;
      }

      const profileDetails = completeProfile.profileDetails || {};
      const medicalInfo = completeProfile.medicalInfo || {};

      this.profileInstructionFallback =
        medicalInfo.generalEmergencyInstruction ||
        medicalInfo.emergencyInstruction ||
        medicalInfo.generalInstruction ||
        '';

      this.patientAvatar = profileDetails.profile_picture || null;
      this.emergencyContactPhone = profileDetails.phone || null;

      const dob = profileDetails.dateOfBirth;

      if (dob) {
        const date = new Date(dob);
        this.formattedDateOfBirth = isNaN(date.getTime())
          ? dob
          : date.toLocaleDateString();
      } else {
        this.formattedDateOfBirth = 'Not specified';
      }

      this.bloodType = profileDetails.bloodType || null;
    } catch (error) {
      console.warn('Unable to load profile instructions:', error);
    }
  }

  get profileEmergencyInstruction(): string {
    return this.profileInstructionFallback;
  }

  get hasEmergencyInstruction(): boolean {
    return !!(this.eventSpecificInstruction || this.profileEmergencyInstruction);
  }

  get eventSpecificInstruction(): string {
    return (
      this.currentEmergency?.instruction ||
      this.currentEmergency?.emergencyData?.emergencyInstruction ||
      ''
    );
  }

  get displayedEmergencyInstruction(): string {
    return (
      this.eventSpecificInstruction ||
      this.profileEmergencyInstruction ||
      'No instructions available'
    );
  }

  get isAnotherBuddyResponding(): boolean {
    return (
      !!this.currentEmergency &&
      this.currentEmergency.status === 'responding' &&
      !!this.currentEmergency.responderId &&
      this.currentEmergency.responderId !== this.currentUserId
    );
  }

  get primaryResponderName(): string {
    return this.currentEmergency?.responderName || 'A buddy';
  }

  get emergencyStatusLabel(): string {
    if (!this.currentEmergency) {
      return 'Unknown';
    }

    if (this.currentEmergency.status === 'active') {
      return 'Emergency active';
    }

    if (this.currentEmergency.status === 'responding') {
      if (this.currentEmergency.responderId === this.currentUserId) {
        return 'You are responding';
      }

      return `${this.primaryResponderName} is responding`;
    }

    if (this.currentEmergency.status === 'resolved') {
      return 'Resolved';
    }

    return 'Unknown';
  }

  toDate(value: Date | Timestamp | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Timestamp) {
    return value.toDate();
  }

  return null;
}
}