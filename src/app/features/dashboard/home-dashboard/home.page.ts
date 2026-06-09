import { Component, OnDestroy } from '@angular/core';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BuddyService } from '../../../core/services/buddy.service';
import { EmergencyService } from '../../../core/services/emergency.service';
import { EmergencyNotificationService } from '../../../core/services/emergency-notification.service';
import { UserService } from '../../../core/services/user.service';
import { MedicalService } from '../../../core/services/medical.profile.service';
import { LocationPermissionService } from '../../../core/services/location-permission.service';
import { Subscription } from 'rxjs';
import { AllergyManagerService } from '../../../core/services/allergy-manager.service';
import { AllergyModalService } from '../../profile/profile-services/allergy-modal.service';


const EMERGENCY_CONFIRMATION_SECONDS = 5;
const HOTLINE_FALLBACK_DELAY_MS = 60_000;

interface BuddyResponse {
  status: string;
  timestamp: Date;
  name: string;
}

interface ResponderInfo {
  responderName: string;
  estimatedTime: string;
  distance: number;
  estimatedArrival: number;
  emergencyId: string;
}


@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {

  userBuddies: any[] = [];
  userAllergies: any[] = [];
  userName = '';
  emergencyInstruction = '';
 
  isEmergencyActive = false;
  emergencyStartTime: Date | null = null;
  currentEmergencyId: string | null = null;

  buddyResponses: Record<string, BuddyResponse> = {};
  emergencyLocation: { latitude: number; longitude: number } | null = null;
  emergencyAddress = '';
  isEmergencyAddressLoading = false;

  notificationStatus: Record<string, 'sending' | 'sent' | 'failed' | 'pending'> = {};

  respondingBuddy: ResponderInfo | null = null;
  minimizedResponder: ResponderInfo | null = null;

  showBuddyBanner = false;
  showAllergyBanner = false;

  emergencyConfirmationTimeLeft = EMERGENCY_CONFIRMATION_SECONDS;

  private subscriptions: Subscription[] = [];
  private buddyStatusKeyMap = new Map<string, string>();
  private emergencyConfirmationTimer: ReturnType<typeof setInterval> | null = null;
 

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private router: Router,
    private authService: AuthService,
    private buddyService: BuddyService,
    private emergencyService: EmergencyService,
    private emergencyNotificationService: EmergencyNotificationService,
    private userService: UserService,
    private medicalService: MedicalService,
    private allergyManager: AllergyManagerService,
    private allergyModalService: AllergyModalService,
    private locationPermissionService: LocationPermissionService,
  ) {}

  async ionViewWillEnter(): Promise<void> {
    this.unsubscribeAll();

    try {
      await this.loadUserData();
      await this.restoreActiveEmergency();
    } finally {
      this.listenForNotificationStatus();
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeAll();
    this.clearConfirmationTimer();
  }

  async loadUserData(): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      const [userProfile, medicalInfo] = await Promise.all([
        this.userService.getUserProfile(currentUser.uid),
        this.medicalService.getUserMedicalProfile(currentUser.uid),
      ]);

      this.userName = userProfile?.fullName ?? 'User';

      this.emergencyInstruction =
        this.emergencyService.resolveEmergencyInstruction(medicalInfo);

      this.userAllergies = Array.isArray(medicalInfo?.allergies)
        ? medicalInfo.allergies.filter((a: any) => a.checked)
        : [];

      this.showAllergyBanner = this.userAllergies.length === 0;

      this.userBuddies = await this.buddyService.getUserBuddies(currentUser.uid);

      this.rebuildBuddyStatusKeyMap();
      this.showBuddyBanner = this.userBuddies.length === 0;

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  private rebuildBuddyStatusKeyMap(): void {
    this.buddyStatusKeyMap.clear();
    for (const buddy of this.userBuddies) {
      const canonical = buddy.buddyUid || buddy.id;
      if (buddy.id)       this.buddyStatusKeyMap.set(buddy.id, canonical);
      if (buddy.buddyUid) this.buddyStatusKeyMap.set(buddy.buddyUid, canonical);
    }
  }


  triggerEmergency(): void {
    if (this.isEmergencyActive) {
      this.presentToast('An emergency alert is already active.', 'warning');
      return;
    }
    this.presentEmergencyConfirmation();
  }

  async presentEmergencyConfirmation(): Promise<void> {
    this.clearConfirmationTimer();
    this.emergencyConfirmationTimeLeft = EMERGENCY_CONFIRMATION_SECONDS;

    const buildMessage = () =>
      `Your emergency alert is about to be sent. Are you sure?\n\nAuto-sending in: ${this.emergencyConfirmationTimeLeft}s`;

    let alertRef: HTMLIonAlertElement;

    alertRef = await this.alertController.create({
      header: 'EMERGENCY ALERT!',
      message: buildMessage(),
      buttons: [
        {
          text: 'SEND ALERT',
          handler: () => {
            this.clearConfirmationTimer();
            this.sendEmergencyAlert();
          },
        },
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => this.clearConfirmationTimer(),
        },
      ],
    });

    await alertRef.present();

    this.emergencyConfirmationTimer = setInterval(() => {
      this.emergencyConfirmationTimeLeft--;

      const el = alertRef?.querySelector?.('.alert-message');
      if (el) el.textContent = buildMessage();

      if (this.emergencyConfirmationTimeLeft <= 0) {
        this.clearConfirmationTimer();
        alertRef.dismiss();
        this.sendEmergencyAlert();
      }
    }, 1000);
  }

  private clearConfirmationTimer(): void {
    if (this.emergencyConfirmationTimer !== null) {
      clearInterval(this.emergencyConfirmationTimer);
      this.emergencyConfirmationTimer = null;
    }
  }
  async sendEmergencyAlert(): Promise<void> {
    if (this.isEmergencyActive) {
      await this.presentToast('An emergency alert is already active.', 'warning');
      return;
    }

    await this.requestLocationPermission();

    const loading = await this.loadingController.create({
      message: 'Getting location and sending emergency alert...',
      duration: 15_000,
    });
    await loading.present();

    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) throw new Error('User not authenticated');

      const latestMedical = await this.medicalService.getUserMedicalProfile(currentUser.uid);
      this.emergencyInstruction =
        this.emergencyService.resolveEmergencyInstruction(latestMedical, this.emergencyInstruction);

      const buddyIds = this.resolveBuddyIds(currentUser.uid);
      const allergyStrings = this.resolveAllergyStrings();
      const locationData = await this.resolveLocation();

      this.currentEmergencyId = await this.emergencyService.sendEmergencyAlert(
        currentUser.uid,
        this.userName,
        buddyIds,
        allergyStrings,
        this.emergencyInstruction,
        locationData,
      );

      this.activateEmergencyState(locationData);
      this.seedInitialBuddyResponses(currentUser.uid);
      this.listenForEmergencyResponses();

      await loading.dismiss();
      await this.notifyUserAfterSend(buddyIds);

    } catch (error) {
      await loading.dismiss();
      console.error('Error sending emergency alert:', error);
      await this.presentToast('Failed to send emergency alert. Please try again.');
    }
  }

  private async requestLocationPermission(): Promise<void> {
    try {
      const result = await this.locationPermissionService.requestLocationPermissions();
      if (!result.granted) console.warn('Location permission not granted:', result.message);
    } catch (err) {
      console.warn('Error requesting location permission:', err);
    }
  }

  private resolveBuddyIds(currentUid: string): string[] {
    return Array.from(new Set(
      this.userBuddies
        .map(b => b.buddyUid || b.id)
        .filter((id): id is string => !!id && id !== currentUid),
    ));
  }

  private resolveAllergyStrings(): string[] {
    return this.userAllergies
      .map((a: any) => a.label || a.name || '')
      .filter(Boolean);
  }

  private async resolveLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const position = await this.emergencyService.getCurrentLocation();
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      this.emergencyLocation = locationData;
      this.isEmergencyAddressLoading = true;
      return locationData;
    } catch {
      console.warn('Location unavailable — alert will continue without precise location.');
      this.emergencyLocation = null;
      this.isEmergencyAddressLoading = false;
      return null;
    }
  }

  private activateEmergencyState(
    locationData: { latitude: number; longitude: number } | null,
  ): void {
    this.isEmergencyActive = true;
    this.emergencyStartTime = new Date();
    this.buddyResponses = {};
    if (locationData) this.emergencyLocation = locationData;
  }

  private seedInitialBuddyResponses(currentUid: string): void {
    for (const buddy of this.userBuddies) {
      const key = buddy.buddyUid || buddy.id;
      if (!key || key === currentUid) continue;

      this.buddyResponses[key] = {
        status: 'sent',
        timestamp: new Date(),
        name:
          buddy.buddyName ||
          `${buddy.firstName || ''} ${buddy.lastName || ''}`.trim() ||
          'Buddy',
      };
    }
  }

  private async notifyUserAfterSend(buddyIds: string[]): Promise<void> {
    if (buddyIds.length > 0) {
      await this.presentToast(
        `Emergency alert sent to ${buddyIds.length} connections. Notifications are being delivered.`,
      );
    } else {
      await this.presentToast(
        'No emergency contacts available. Please contact emergency services.',
      );
      await this.callEmergencyHotlines();
    }
  }


  async restoreActiveEmergency(): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) return;

    const emergencies = await this.emergencyService.getUserEmergenciesByStatus(
      currentUser.uid,
      ['active', 'responding'],
    );

    if (!emergencies.length) {
      this.clearEmergencyState();
      return;
    }

    const emergency = emergencies[0];

    this.currentEmergencyId = emergency.id ?? null;
    this.isEmergencyActive = true;
    this.emergencyStartTime = emergency.timestamp?.toDate
      ? emergency.timestamp.toDate()
      : new Date();

    if (emergency.location) {
      this.emergencyLocation = {
        latitude: emergency.location.latitude,
        longitude: emergency.location.longitude,
      };
    }

    this.emergencyAddress = emergency.displayAddress
      ? emergency.displayAddress
      : emergency.location
        ? 'GPS location available'
        : '';
    this.isEmergencyAddressLoading = false;

    if (emergency.buddyResponses) {
      this.processBuddyResponses(emergency.buddyResponses, currentUser.uid);
    }

    if (emergency.status === 'responding' && emergency.responderId) {
      this.respondingBuddy = this.buildResponderInfo(emergency);
    }

    if (this.currentEmergencyId) {
      this.emergencyService.startPatientLocationTracking(this.currentEmergencyId);
    }

    this.listenForEmergencyResponses();
  }


  listenForEmergencyResponses(): void {
    if (!this.currentEmergencyId) return;

    const responseSub = this.emergencyService.emergencyResponse$.subscribe(response => {
      if (!response || response.emergencyId !== this.currentEmergencyId) return;
      this.respondingBuddy = this.buildResponderInfo(response);
      this.presentToast(`${response.responderName ?? 'A responder'} is on the way.`);
    });

    const docSub = this.emergencyService.userEmergency$.subscribe(emergency => {
      if (!emergency || emergency.id !== this.currentEmergencyId) return;

      if (emergency.status === 'resolved') {
        this.clearEmergencyState();
        return;
      }

      if (emergency.displayAddress) {
        this.emergencyAddress = emergency.displayAddress;
        this.isEmergencyAddressLoading = false;
      }

      if (emergency.location) {
        this.emergencyLocation = {
          latitude: emergency.location.latitude,
          longitude: emergency.location.longitude,
        };
      }

      if (emergency.buddyResponses) {
        this.processBuddyResponses(emergency.buddyResponses);
      }

      if (emergency.status === 'responding' && emergency.responderId) {
        this.respondingBuddy = this.buildResponderInfo(emergency);
      }
    });

    this.subscriptions.push(responseSub, docSub);
  }

  listenForNotificationStatus(): void {
    const sub = this.emergencyNotificationService.notificationStatus$.subscribe(status => {
      this.notificationStatus = { ...status };
    });
    this.subscriptions.push(sub);
  }

  /**
   * Normalises the raw buddyResponses map from Firestore, emits toasts for
   * status changes, and checks whether all responders are unavailable.
   *
   * @param responses   Raw Firestore map.
   * @param excludeUid  Optional UID to skip (e.g. current user on restore).
   */
  private processBuddyResponses(responses: any, excludeUid?: string): void {
    const previous = { ...this.buddyResponses };
    this.buddyResponses = {};

    for (const [buddyId, response] of Object.entries(responses) as [string, any][]) {
      if (excludeUid && buddyId === excludeUid) continue;

      const oldStatus = previous[buddyId]?.status;
      const newStatus = response.status as string;

      this.buddyResponses[buddyId] = {
        status: newStatus,
        timestamp: response.timestamp?.toDate?.() ?? new Date(),
        name: response.name ?? 'Buddy',
      };

      this.handleBuddyStatusChange(response.name ?? 'A buddy', oldStatus, newStatus);
    }

    this.checkIfNoRespondersAvailable();
  }

  private handleBuddyStatusChange(
    buddyName: string,
    oldStatus: string | undefined,
    newStatus: string,
  ): void {
    if (newStatus === oldStatus) return;

    switch (newStatus) {
      case 'responded':
        this.presentToast(`${buddyName} is on the way to help you.`, 'success');
        break;
      case 'cannot_respond':
        this.presentToast(`${buddyName} declined your emergency alert.`, 'warning');
        break;
      case 'timed_out':
        this.presentToast(`${buddyName} did not respond in time.`, 'warning');
        break;
    }
  }

  private checkIfNoRespondersAvailable(): void {
    const responses = Object.values(this.buddyResponses);
    if (!responses.length) return;

    const allUnavailable = responses.every(
      r => r.status === 'cannot_respond' || r.status === 'timed_out',
    );

    if (allUnavailable) {
      this.presentToast(
        'No buddy is available to respond. Emergency hotline options are now available.',
        'danger',
      );
    }
  }

  async resolveEmergency(): Promise<void> {
    if (!this.currentEmergencyId) return;

    const alert = await this.alertController.create({
      header: 'Resolve Emergency',
      message: 'Are you sure you want to mark this emergency as resolved?',
      buttons: [
        {
          text: 'Resolve',
          handler: async () => {
            try {
              await this.emergencyService.resolveEmergency(this.currentEmergencyId!);
              this.clearEmergencyState();
              await this.presentToast('Emergency resolved successfully');
            } catch (error) {
              console.error('Error resolving emergency:', error);
              await this.presentToast('Failed to resolve emergency');
            }
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });

    await alert.present();
  }

  clearEmergencyState(): void {
    this.isEmergencyActive = false;
    this.emergencyStartTime = null;
    this.currentEmergencyId = null;
    this.buddyResponses = {};
    this.emergencyLocation = null;
    this.emergencyAddress = '';
    this.isEmergencyAddressLoading = false;
    this.respondingBuddy = null;
    this.minimizedResponder = null;
  }

  async openResponderMap(response?: ResponderInfo): Promise<void> {
    const data = response ?? this.minimizedResponder;
    if (!data?.emergencyId) return;

    await this.router.navigate(['/tabs/patient-map'], {
      state: { emergencyId: data.emergencyId, responderName: data.responderName ?? 'Responder' },
    });
  }

  dismissToMinimized(): void {
    this.minimizedResponder = this.respondingBuddy;
    this.respondingBuddy = null;
  }

  restoreResponder(): void {
    this.respondingBuddy = this.minimizedResponder;
    this.minimizedResponder = null;
  }

  dismissMinimized(): void {
    this.minimizedResponder = null;
  }

  getBuddyResponseStatus(buddyId: string): string {
    const resolvedId = this.buddyStatusKeyMap.get(buddyId) ?? buddyId;
    const response = this.buddyResponses[resolvedId];
    if (!response) return 'Unknown';

    switch (response.status) {
      case 'sent':           return 'Alert Sent';
      case 'responded':      return `${response.name} is responding`;
      case 'cannot_respond': return `${response.name} declined`;
      default:               return response.status;
    }
  }

  getBuddyResponseColor(buddyId: string): string {
    const resolvedId = this.buddyStatusKeyMap.get(buddyId) ?? buddyId;
    const response = this.buddyResponses[resolvedId];
    if (!response) return 'medium';

    switch (response.status) {
      case 'sent':           return 'warning';
      case 'responded':      return 'success';
      case 'cannot_respond': return 'danger';
      default:               return 'medium';
    }
  }

  hasBuddyResponses(): boolean {
    return Object.keys(this.buddyResponses).length > 0;
  }

  getNotificationStatus(buddyId: string): string {
    const status = this.resolvedNotificationStatus(buddyId);
    switch (status) {
      case 'sending': return 'Sending...';
      case 'sent':    return 'Notified';
      case 'failed':  return 'Failed';
      default:        return 'Pending...';
    }
  }

  getNotificationStatusColor(buddyId: string): string {
    const status = this.resolvedNotificationStatus(buddyId);
    switch (status) {
      case 'sending': return 'warning';
      case 'sent':    return 'success';
      case 'failed':  return 'danger';
      default:        return 'medium';
    }
  }

  shouldShowNotificationBadge(buddyId: string): boolean {
    const resolvedId = this.buddyStatusKeyMap.get(buddyId) ?? buddyId;
    return this.buddyResponses[resolvedId]?.status !== 'cannot_respond';
  }

  private resolvedNotificationStatus(
    buddyId: string,
  ): 'sending' | 'sent' | 'failed' | 'pending' {
    const resolvedId = this.buddyStatusKeyMap.get(buddyId) ?? buddyId;
    return this.notificationStatus[resolvedId] ?? 'pending';
  }

  shouldShowHotlineFallback(): boolean {
    if (!this.isEmergencyActive) return false;
    if (this.userBuddies.length === 0) return true;

    const ids = Object.keys(this.buddyResponses);

    if (ids.length === 0) {
      if (!this.emergencyStartTime) return false;
      return Date.now() - this.emergencyStartTime.getTime() > HOTLINE_FALLBACK_DELAY_MS;
    }

    return ids.every(
      id =>
        this.buddyResponses[id]?.status === 'cannot_respond' ||
        this.buddyResponses[id]?.status === 'timed_out',
    );
  }

  async callEmergencyHotlines(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'No Emergency Contacts',
      message:
        'No buddies are available. You can contact emergency services directly instead.',
      buttons: [
        { text: 'Call 911',           handler: () => this.callNumber('911') },
        { text: 'Call 117',           handler: () => this.callNumber('117') },
        { text: 'Call Red Cross 143', handler: () => this.callNumber('143') },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await alert.present();
  }

  callNumber(number: string): void {
    window.open(`tel:${number}`, '_system');
  }

  openNotifications(): void {
    this.router.navigate(['/tabs/notification']);
  }

  openPollenMap(): void {
    this.router.navigate(['/tabs/pollen-map']);
  }

  getAllergensDisplay(): string {
    return this.userAllergies.map((a: any) => a.label || a.name).join(', ');
  }

  getAllergensCount(): number {
    return this.userAllergies?.length ?? 0;
  }

  async openAddAllergiesModal(): Promise<void> {
    const allergyOptions = await this.allergyManager.loadAllergyOptions();
    await this.allergyModalService.openEditAllergiesModal(
      allergyOptions,
      () => this.loadUserData(),
      'add',
    );
  }

  getBuddiesCount(): number {
    return this.userBuddies?.length ?? 0;
  }

  getObjectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  async presentToast(
    message: string,
    color: 'success' | 'warning' | 'danger' | 'primary' = 'primary',
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 4_000,
      position: 'top',
      color,
    });
    await toast.present();
  }
  private unsubscribeAll(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.subscriptions = [];
  }

  /** Maps any shape of emergency/response document to a consistent ResponderInfo. */
  private buildResponderInfo(source: any): ResponderInfo {
    return {
      responderName: source.responderName ?? source.responder_name ?? 'A buddy',
      estimatedTime: source.estimatedArrival ? `${source.estimatedArrival} min` : 'Calculating...',
      distance: source.distance ?? 0,
      estimatedArrival: source.estimatedArrival ?? 0,
      emergencyId: source.emergencyId ?? source.id ?? '',
    };
  }
}