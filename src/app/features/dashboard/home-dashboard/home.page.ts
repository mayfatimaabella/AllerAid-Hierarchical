import { Component, OnDestroy } from '@angular/core';
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
import { EmergencyAlertService } from '../../../core/services/emergency-alert.service';
import { AlertController, ToastController } from '@ionic/angular';
import { Timestamp } from 'firebase/firestore';
import { Allergy } from '../../../core/models/allergy.model';
import { Buddy } from 'src/app/core/models/buddy.model';
import { BuddyStatus } from 'src/app/core/models/buddy-status.model';
import { EmergencyAlert } from 'src/app/core/models/emergency-alert.model';
import { MedicalInfo } from 'src/app/core/models/medical-info.model';
import { UserProfile } from 'src/app/core/models/user-profile.model';
import { BuddyResponse,BuddyResponsePayload, BuddyResponseStatus} from 'src/app/core/models/buddy-response.model';
import { NotificationStatusValues, NotificationStatus} from 'src/app/core/models/notification-status.model';
import { ResponderInfo, ResponderSource } from 'src/app/core/models/responder-info.model';
import { EmergencyStatusValues } from 'src/app/core/models/emergency-status.model';

const HOTLINE_FALLBACK_DELAY_MS = 60_000;

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {

  //User Data
  userName = '';
  userAllergies: Allergy[] = [];
  userBuddies: Buddy[] = [];
  emergencyInstruction = '';
 
  //Emergency State
  isEmergencyActive = false;
  emergencyStartTime: Date | null = null;
  currentEmergencyId: string | null = null;

  emergencyLocation: {
  latitude: number;
  longitude: number;
  accuracy?: number;
} | null = null;

  emergencyAddress = '';
  isEmergencyAddressLoading = false;

  //Buddy and Notification State
  buddyResponses: Record<string, BuddyResponse> = {};
  notificationStatus: Record<string, NotificationStatus> = {};

  respondingBuddy: ResponderInfo | null = null;
  minimizedResponder: ResponderInfo | null = null;

  buddyBannerState: 'none' | 'pending' | 'accepted' = 'none';
  pendingBuddyInviteCount = 0;

  //UI State
  showBuddyBanner = false;
  showAllergyBanner = false;

  showEmergencyCountdown = false;
  countdown = 3;

  showEmergencySending = false;

  sendingStep: | 'preparing' | 'location' | 'sending' | 'waiting' | 'done' = 'preparing';

  //Internal

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptions: Subscription[] = [];
  private buddyStatusKeyMap = new Map<string, string>();
 

  constructor(
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
    private emergencyAlertService: EmergencyAlertService,
    private alertController: AlertController,
    private toastController: ToastController
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
      if (this.countdownTimer) {
    clearInterval(this.countdownTimer);
     this.countdownTimer = null;
  }

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

       this.loadUserProfile(userProfile);
      this.loadMedicalData(medicalInfo);
      await this.loadBuddyData(currentUser.uid);

    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  private loadMedicalData(medicalInfo: MedicalInfo | null): void {
    if (!medicalInfo) {
      this.userAllergies = [];
      this.showAllergyBanner = true;
      return;
    }

    this.emergencyInstruction = this.emergencyService.getEmergencyInstruction(medicalInfo);

    this.userAllergies = (medicalInfo.allergies ?? []).filter(allergy => allergy.checked);

    this.showAllergyBanner = this.userAllergies.length === 0;
  }

  private async loadBuddyData(userId: string): Promise<void> {
    this.userBuddies = await this.buddyService.getUserBuddies(userId);
    
    this.rebuildBuddyStatusKeyMap();

    const pendingInvites =
      await this.buddyService.getSentInvitations(userId);

    this.pendingBuddyInviteCount = pendingInvites.filter(
      invite => invite.status === 'pending'
    ).length;

    this.updateBuddyBannerState();

  }

  private loadUserProfile(userProfile: UserProfile | null): void {
  this.userName = userProfile?.fullName ?? 'User';
}

  private rebuildBuddyStatusKeyMap(): void {
    this.buddyStatusKeyMap.clear();
    for (const buddy of this.userBuddies) {
      const canonical = buddy.buddyUid  || buddy.id;
      if (buddy.id)       this.buddyStatusKeyMap.set(buddy.id, canonical);
      if (buddy.buddyUid) this.buddyStatusKeyMap.set(buddy.buddyUid, canonical);
    }
  }


  triggerEmergency(): void {

    //1. Check if there's an active alert
    if (this.isEmergencyActive) {
      this.presentToast('An emergency alert is already active.', 'warning');
      return;
    }

    if (this.showEmergencyCountdown) {
      return;
    }

    //2. Five second timer for user to cancel
    this.showEmergencyCountdown = true;
    this.startCountdown();
  }

  async sendEmergencyAlert(): Promise<void> {
    this.showEmergencySending = true;

    try {
      this.sendingStep = 'preparing';

      if (!(await this.validateEmergencyState())) {
        return;
      }
      if (!(await this.validateLocationPermission())) {
         return;
      }
      if (!(await this.validateAuthentication())) {
        return;
      }
      await this.triggerEmergencyWorkflow();


    } catch (error) {
      this.emergencyAlertService.stopEmergencyAlarmSound();

      console.error('Error triggering emergency alert:', error);
      await this.presentToast('Failed to send emergency alert. Please try again.','danger');

    } finally {
      this.showEmergencySending = false;
    }
  }

  private async validateEmergencyState(): Promise<boolean> {
  if (!this.isEmergencyActive) {
    return true;
  }

  await this.presentToast('An emergency alert is already active.','warning');
  return false;
}

    private async validateLocationPermission(): Promise<boolean> {
      this.sendingStep = 'location';

      const hasLocationPermission =
        await this.ensureLocationPermission();

      if (hasLocationPermission) {
        return true;
      }

      await this.presentToast(
        'Location permission is required before sending an emergency alert.',
        'danger'
      );

      return false;
    }

private async validateAuthentication(): Promise<boolean> {

  const currentUser = await this.authService.waitForAuthInit();

  if (currentUser) {
    return true;
  }

  await this.presentToast(
    'You must be logged in to send an emergency alert.',
    'danger'
  );

  await this.router.navigate(['/login']);

  return false;
}

private async triggerEmergencyWorkflow(): Promise<void> {

  this.sendingStep = 'sending';

  const result =
    await this.emergencyAlertService.triggerEmergencyAlert('manual');

  this.currentEmergencyId = result.emergencyId;

  this.activateEmergencyState(result.location);

  this.listenForEmergencyResponses();

  this.sendingStep = 'waiting';

  await this.notifyUserAfterSend(this.userBuddies.length);

}




  private async ensureLocationPermission(): Promise<boolean> {
    try {
      const alreadyGranted = await this.locationPermissionService.isLocationAvailable();

      if (alreadyGranted) {
        return true;
      }

      const result = await this.locationPermissionService.requestLocationPermissions();

      if (!result.granted) {
        console.warn('Location permission not granted:', result.message);
        return false;
      }

      return true;

    } catch (error) {
      console.warn('Error checking/requesting location permission:', error);
      return false;
    }
  }


  private activateEmergencyState(
    locationData?: { latitude: number; longitude: number; accuracy?: number },
    ): void {
        this.isEmergencyActive = true;
        this.emergencyStartTime = new Date();
        this.buddyResponses = {};

        if (locationData) {
          this.emergencyLocation = locationData;
          this.emergencyAddress = 'GPS location available';
        } else {
          this.emergencyLocation = null;
          this.emergencyAddress = 'Location unavailable';
        }

        this.isEmergencyAddressLoading = false;
    }


    private async notifyUserAfterSend(buddyCount: number): Promise<void> {
      if (buddyCount  > 0) {
        await this.presentToast(
          `Emergency alert sent to ${buddyCount} connections. Notifications are being delivered.`,
          'success'
        );
      } else {
        await this.presentToast(
          'No emergency contacts available. Please contact emergency services.',
          'danger'
        );
        await this.callEmergencyHotlines();
      }
    }


async restoreActiveEmergency(): Promise<void> {
  const currentUser = await this.authService.waitForAuthInit();
  if (!currentUser) return;

  const emergencies = await this.emergencyService.getUserEmergenciesByStatus(
    currentUser.uid,
    [EmergencyStatusValues.ACTIVE,
    EmergencyStatusValues.RESPONDING,],
  );

  if (!emergencies.length) {
    this.clearEmergencyState();
    return;
  }

  const emergency = emergencies[0];

  this.restoreEmergencyState(emergency);
  this.restoreEmergencyAddress(emergency);
  this.restoreBuddyInformation(emergency, currentUser.uid);



  if (this.currentEmergencyId) {
await this.resumeEmergencyServices();
  }
}

private restoreEmergencyState(emergency: EmergencyAlert): void {
  this.currentEmergencyId = emergency.id ?? null;
  this.isEmergencyActive = true;

  this.emergencyStartTime =
    emergency.timestamp instanceof Timestamp
      ? emergency.timestamp.toDate()
      : emergency.timestamp;
}

  private restoreEmergencyAddress(emergency: EmergencyAlert): void {
    this.emergencyAddress = emergency.displayAddress
      ? emergency.displayAddress
      : emergency.location
        ? 'GPS location available'
        : '';

    this.isEmergencyAddressLoading = false;
  }

  private restoreBuddyInformation(
    emergency: EmergencyAlert,
    currentUserId: string
  ): void {

    if (emergency.buddyResponses) {
      this.processBuddyResponses(
        emergency.buddyResponses,
        currentUserId
      );
    }

    if (emergency.notificationStatus) {
      this.notificationStatus = {
        ...this.notificationStatus,
        ...emergency.notificationStatus
      };
    }

    if (
      emergency.status === EmergencyStatusValues.RESPONDING  &&
      emergency.responderId
    ) {
      this.respondingBuddy =
        this.buildResponderInfo(emergency);
    }
  }

  private async resumeEmergencyServices(): Promise<void> {

  if (this.currentEmergencyId) {
    this.emergencyService.startPatientLocationTracking(
      this.currentEmergencyId
    );
  }

  try {
    await this.emergencyAlertService.playEmergencyAlarmSound(
      this.buildEmergencySpeechText()
    );
  } catch (error) {
    console.warn(
      'Could not resume emergency alarm sound:',
      error
    );
  }

  this.listenForEmergencyResponses();

}


listenForEmergencyResponses(): void {
  if (!this.currentEmergencyId) return;

  this.listenForResponderUpdates();
  this.listenForEmergencyUpdates();
}

private listenForResponderUpdates(): void {

  const responseSub =
    this.emergencyService.emergencyResponse$
      .subscribe(response => {

        if (
          !response ||
          response.emergencyId !== this.currentEmergencyId
        ) {
          return;
        }

        this.respondingBuddy =
          this.buildResponderInfo(response);

        this.presentToast(
          `${response.responderName ?? 'A responder'} is on the way.`
        );
      });

  this.subscriptions.push(responseSub);
}

private listenForEmergencyUpdates(): void {

  const docSub =
    this.emergencyService.userEmergency$
      .subscribe(emergency => {

        if (
          !emergency ||
          emergency.id !== this.currentEmergencyId
        ) {
          return;
        }

        this.handleEmergencyUpdate(emergency);

      });

  this.subscriptions.push(docSub);
}

      private handleEmergencyUpdate(
      emergency: EmergencyAlert
    ): void {

      if (emergency.status === EmergencyStatusValues.RESOLVED) {
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

      if (
        emergency.status === EmergencyStatusValues.RESPONDING &&
        emergency.responderId
      ) {
        this.respondingBuddy = this.buildResponderInfo(emergency);
      }
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
  private processBuddyResponses(responses: Record<string, BuddyResponsePayload>, excludeUid?: string): void {
    const previous = { ...this.buddyResponses };
    this.buddyResponses = {};

    for (const [buddyId, response] of Object.entries(responses)) {
      if (excludeUid && buddyId === excludeUid) continue;

      const oldStatus = previous[buddyId]?.status;
      const newStatus = response.status;

      this.buddyResponses[buddyId] = {
       status: response.status,
        timestamp: response.timestamp?.toDate?.() ?? new Date(),
        name: response.name ?? 'Buddy',
      };

      this.handleBuddyStatusChange(response.name ?? 'A buddy', oldStatus, newStatus);
    }

    this.checkIfNoRespondersAvailable();
  }

  private handleBuddyStatusChange(
      buddyName: string,
      oldStatus: BuddyResponseStatus | undefined,
      newStatus: BuddyResponseStatus,
  ): void {
    if (newStatus === oldStatus) return;

    switch (newStatus) {
      case BuddyStatus.RESPONDED:
        break;
      case BuddyStatus.CANNOT_RESPOND:
        this.presentToast(`${buddyName} declined your emergency alert.`, 'warning');
        break;
      case BuddyStatus.TIMED_OUT:
        this.presentToast(`${buddyName} did not respond in time.`, 'warning');
        break;
    }
  }

  private checkIfNoRespondersAvailable(): void {
    const responses = Object.values(this.buddyResponses);
    if (!responses.length) return;

    const allUnavailable = responses.every(
      r => r.status === BuddyStatus.CANNOT_RESPOND || r.status === BuddyStatus.TIMED_OUT,
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

  private buildEmergencySpeechText(): string {
    const locationText = this.emergencyAddress ||
      (this.emergencyLocation
        ? `${this.emergencyLocation.latitude.toFixed(4)}, ${this.emergencyLocation.longitude.toFixed(4)}`
        : 'location unavailable');

    return `Emergency alert from ${this.userName || 'the patient'}. ${this.emergencyInstruction || 'No instructions available'}. Patient location is ${locationText}.`;
  }

  clearEmergencyState(): void {
    this.emergencyAlertService.stopEmergencyAlarmSound();

    this.isEmergencyActive = false;
    this.emergencyStartTime = null;
    this.currentEmergencyId = null;
    this.buddyResponses = {};
    this.notificationStatus = {};
    this.emergencyLocation = null;
    this.emergencyAddress = '';
    this.isEmergencyAddressLoading = false;
    this.respondingBuddy = null;
    this.minimizedResponder = null;
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
  case NotificationStatusValues.SENT:
    return 'Alert Sent';

  case BuddyStatus.RESPONDED:
    return `${response.name} is responding`;

  case BuddyStatus.CANNOT_RESPOND:
    return `${response.name} declined`;

  case BuddyStatus.TIMED_OUT:
    return `${response.name} did not respond`;

  default:
    return response.status;
}
  }

  getBuddyResponseColor(buddyId: string): string {
    const resolvedId = this.buddyStatusKeyMap.get(buddyId) ?? buddyId;
    const response = this.buddyResponses[resolvedId];
    if (!response) return 'medium';

    switch (response.status) {
      case NotificationStatusValues.SENT:           return 'warning';
      case BuddyStatus.RESPONDED:      return 'success';
      case BuddyStatus.CANNOT_RESPOND: return 'danger';
      default:               return 'medium';
    }
  }

  hasBuddyResponses(): boolean {
    return Object.keys(this.buddyResponses).length > 0;
  }

  getNotificationStatus(buddyId: string): string {
    const status = this.resolvedNotificationStatus(buddyId);
    switch (status) {
      case NotificationStatusValues.SENDING:   return 'Sending...';
      case NotificationStatusValues.PENDING:   return 'Pending...';
      case NotificationStatusValues.SENT:      return 'Push Sent';
      case NotificationStatusValues.DELIVERED: return 'Received';
     case NotificationStatusValues.RECEIVED_IN_APP: return 'Received in App';
      case NotificationStatusValues.FAILED:    return 'Failed';
      default:        return 'Pending...';
    }
  }

  getNotificationStatusColor(buddyId: string): string {
    const status = this.resolvedNotificationStatus(buddyId);
    switch (status) {
      case NotificationStatusValues.SENDING:   return 'warning';
      case NotificationStatusValues.PENDING:   return 'medium';
      case NotificationStatusValues.SENT:      return 'primary';
      case NotificationStatusValues.DELIVERED: return 'success';
      case NotificationStatusValues.RECEIVED_IN_APP: return 'info';
      case NotificationStatusValues.FAILED:    return 'danger';
      default:        return 'medium';
    }
  }

  shouldShowNotificationBadge(buddyId: string): boolean {
    const resolvedId = this.buddyStatusKeyMap.get(buddyId) ?? buddyId;
    return this.buddyResponses[resolvedId]?.status !== BuddyStatus.CANNOT_RESPOND;
  }

  private resolvedNotificationStatus(
    buddyId: string,
  ): NotificationStatus {
    const resolvedId = this.buddyStatusKeyMap.get(buddyId) ?? buddyId;
    return this.notificationStatus[resolvedId] ?? NotificationStatusValues.PENDING;
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
        this.buddyResponses[id]?.status === BuddyStatus.CANNOT_RESPOND ||
        this.buddyResponses[id]?.status === BuddyStatus.TIMED_OUT,
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
    return this.userAllergies
      .map(a => a.label ?? a.name ?? '')
      .filter(Boolean)
      .join(', ');
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

  getObjectKeys(obj: Record<string, unknown>): string[] {
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
  private buildResponderInfo(source: ResponderSource): ResponderInfo {
    return {
      responderName: source.responderName ?? source.responder_name ?? 'A buddy',
      estimatedTime: source.estimatedArrival ? `${source.estimatedArrival} min` : 'Calculating...',
      distance: source.distance ?? 0,
      estimatedArrival: source.estimatedArrival ?? 0,
      emergencyId: source.emergencyId ?? source.id ?? '',
    };
  }

  private updateBuddyBannerState(): void {
    if (this.userBuddies.length > 0) {
      this.buddyBannerState = 'accepted';
      this.showBuddyBanner = false;
      return;
    }

    this.showBuddyBanner = true;

    if (this.pendingBuddyInviteCount > 0) {
      this.buddyBannerState = 'pending';
    } else {
      this.buddyBannerState = 'none';
    }
  }

  startCountdown(): void {

  this.countdown = 3;

  if (this.countdownTimer) {
    clearInterval(this.countdownTimer);
  }

  this.countdownTimer = setInterval(() => {

    this.countdown--;

    if (this.countdown <= 0) {

      clearInterval(this.countdownTimer!);
      this.countdownTimer = null;

      this.showEmergencyCountdown = false;

      this.sendEmergencyAlert();
    }

  }, 1000);

}

cancelEmergencyCountdown(): void {

  if (this.countdownTimer) {
    clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  this.showEmergencyCountdown = false;

}

getEmergencyDuration(): string {
  if (!this.emergencyStartTime) {
    return 'Just now';
  }

  const elapsed = Math.floor(
    (Date.now() - this.emergencyStartTime.getTime()) / 1000
  );

  if (elapsed < 60) {
    return `${elapsed} sec ago`;
  }

  const minutes = Math.floor(elapsed / 60);

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);

  return `${hours} hr ${minutes % 60} min ago`;
}

}