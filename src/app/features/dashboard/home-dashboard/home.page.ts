import { Component, OnInit, OnDestroy } from '@angular/core';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BuddyService } from '../../../core/services/buddy.service';
import { EmergencyService } from '../../../core/services/emergency.service';
import { EmergencyNotificationService } from '../../../core/services/emergency-notification.service';
import { UserService } from '../../../core/services/user.service';
import { MedicalService } from '../../../core/services/medical.profile.service';
import { Subscription } from 'rxjs';
import { doc, getDoc } from 'firebase/firestore';
import { FirebaseService } from '../../../core/services/firebase.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  userBuddies: any[] = [];
  userAllergies: any[] = [];
  userName: string = '';
  emergencyInstruction: string = '';
  currentEmergencyId: string | null = null;
  respondingBuddy: any = null;
  minimizedResponder: any = null;

  isEmergencyActive: boolean = false;
  emergencyStartTime: Date | null = null;
  buddyResponses: { [buddyId: string]: { status: string; timestamp: Date; name: string } } = {};
  private buddyStatusHistory: { [buddyId: string]: string } = {};
  emergencyLocation: { latitude: number; longitude: number } | null = null;
  emergencyAddress: string = '';
  isEmergencyAddressLoading: boolean = false;

  notificationStatus: { [buddyId: string]: 'sending' | 'sent' | 'failed' | 'pending' } = {};

  hasBuddy: boolean = true;
  showBuddyBanner: boolean = false;

  private emergencyConfirmationTimer: any = null;
  emergencyConfirmationTimeLeft: number = 5;

  private subscriptions: Subscription[] = [];
  private db: any;

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
    private firebaseService: FirebaseService
  ) {
    this.db = this.firebaseService.getDb();
  }

  async ngOnInit() {
    await this.loadUserData();
    this.listenForEmergencyResponses();
    this.listenForNotificationStatus();
    this.subscribeToUserEmergency();
  }

  async ionViewWillEnter() {
    await this.loadUserData();
    this.subscribeToUserEmergency();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.clearEmergencyConfirmationTimer();
  }

  async loadUserData() {
    try {
      const currentUser = await this.authService.waitForAuthInit();

      if (currentUser) {
        const userProfile = await this.userService.getUserProfile(currentUser.uid);
        if (userProfile) {
          this.userName = userProfile.fullName || 'User';
        }

        const medicalInfo = await this.medicalService.getUserMedicalProfile(currentUser.uid);

        const messageInstruction = (medicalInfo as any)?.emergencyMessage?.instructions;
        this.emergencyInstruction =
          (typeof messageInstruction === 'string' && messageInstruction.trim()) ||
          medicalInfo?.generalInstruction ||
          '';

        this.userAllergies = Array.isArray(medicalInfo?.allergies)
          ? medicalInfo.allergies.filter((allergy: any) => allergy.checked)
          : [];

        console.log('Loaded allergies:', this.userAllergies);
        console.log('Allergy count:', this.userAllergies.length);

        this.userBuddies = await this.buddyService.getUserBuddies(currentUser.uid);
        await this.checkBuddyStatus();

        this.listenForEmergencyResponses();
        this.subscribeToUserEmergency();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  listenForEmergencyResponses() {
    if (!this.currentEmergencyId) return;

    const responseSubscription = this.emergencyService.emergencyResponse$.subscribe(response => {
      if (response) {
        if (this.buddyResponses[response.responderId]) {
          this.buddyResponses[response.responderId].status = 'responded';
          this.buddyResponses[response.responderId].timestamp = new Date();
        }

        this.respondingBuddy = {
          responderName: response.responderName,
          estimatedTime: response.estimatedArrival ? `${response.estimatedArrival} min` : 'Calculating...',
          distance: response.distance || 0,
          estimatedArrival: response.estimatedArrival || 0,
          emergencyId: response.emergencyId
        };
        this.showResponderAlert(response);
      }
    });

    this.subscriptions.push(responseSubscription);
  }

  private subscribeToUserEmergency() {
    const sub = this.emergencyService.userEmergency$.subscribe(async (emergency) => {
      if (!emergency) {
        this.clearEmergencyState();
        this.emergencyAddress = '';
        return;
      }

      this.currentEmergencyId = emergency.id || this.currentEmergencyId;
      this.isEmergencyActive = emergency.status !== 'resolved';

      if (emergency.timestamp && typeof (emergency.timestamp as any).toDate === 'function') {
        this.emergencyStartTime = (emergency.timestamp as any).toDate();
      }

      if (emergency.status === 'responding' && emergency.responderId) {
        const eta = typeof emergency.estimatedArrival === 'number' ? `${emergency.estimatedArrival} min` : 'Calculating...';
        const distanceKm = typeof emergency.distance === 'number' ? emergency.distance : 0;
        this.respondingBuddy = {
          responderName: emergency.responderName || 'A buddy',
          estimatedTime: eta,
          distance: distanceKm,
          estimatedArrival: emergency.estimatedArrival || 0,
          emergencyId: emergency.id
        };
      } else if (emergency.status === 'resolved') {
        this.clearEmergencyState();
        this.emergencyAddress = '';
      }

      if (emergency.buddyResponses) {
        Object.keys(emergency.buddyResponses).forEach((buddyId) => {
          const responseInfo: any = (emergency.buddyResponses as any)[buddyId];
          if (!responseInfo || !responseInfo.status) return;

          const existing = this.buddyResponses[buddyId];
          const timestamp = responseInfo.timestamp && typeof (responseInfo.timestamp as any).toDate === 'function'
            ? (responseInfo.timestamp as any).toDate()
            : new Date();

          const previousStatus = this.buddyStatusHistory[buddyId];
          this.buddyStatusHistory[buddyId] = responseInfo.status;

          const displayName = responseInfo.name || (existing && existing.name) || 'Buddy';

          this.buddyResponses[buddyId] = { status: responseInfo.status, timestamp, name: displayName };

          if (responseInfo.status === 'cannot_respond' && previousStatus !== 'cannot_respond') {
            this.presentToast(`${displayName} cannot respond to your emergency right now.`);
          }
        });
      }

      if (emergency.location && typeof emergency.location.latitude === 'number' && typeof emergency.location.longitude === 'number') {
        this.emergencyLocation = { latitude: emergency.location.latitude, longitude: emergency.location.longitude };
        this.reverseGeocodeEmergencyAddress(emergency.location.latitude, emergency.location.longitude);
      }
    });
    this.subscriptions.push(sub);
  }

  private async reverseGeocodeEmergencyAddress(lat: number, lng: number) {
    try {
      this.isEmergencyAddressLoading = true;
      const url = `/nominatim/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1&email=support@aller-aid.example`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.emergencyAddress = (data?.display_name || '').trim() || 'Location unavailable';
    } catch (e) {
      this.emergencyAddress = 'Location unavailable';
    } finally {
      this.isEmergencyAddressLoading = false;
    }
  }

  clearEmergencyState() {
    this.isEmergencyActive = false;
    this.emergencyStartTime = null;
    this.currentEmergencyId = null;
    this.buddyResponses = {};
    this.emergencyLocation = null;
    this.respondingBuddy = null;
    this.minimizedResponder = null;
  }

  async resolveEmergency() {
    if (!this.currentEmergencyId) return;

    const alert = await this.alertController.create({
      header: 'Resolve Emergency',
      message: 'Are you sure you want to mark this emergency as resolved?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Resolve',
          handler: async () => {
            try {
              if (this.currentEmergencyId) {
                await this.emergencyService.resolveEmergency(this.currentEmergencyId);
                this.clearEmergencyState();
                await this.presentToast('Emergency resolved successfully');
              }
            } catch (error) {
              console.error('Error resolving emergency:', error);
              await this.presentToast('Failed to resolve emergency');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  getBuddyResponseStatus(buddyId: string): string {
    const response = this.buddyResponses[buddyId];
    if (!response) return 'Unknown';
    switch (response.status) {
      case 'sent': return 'Alert Sent';
      case 'responded': return 'Responded';
      case 'cannot_respond': return 'Cannot Respond';
      default: return response.status;
    }
  }

  getBuddyResponseColor(buddyId: string): string {
    const response = this.buddyResponses[buddyId];
    if (!response) return 'medium';
    switch (response.status) {
      case 'sent': return 'warning';
      case 'responded': return 'success';
      case 'cannot_respond': return 'danger';
      default: return 'medium';
    }
  }

  getObjectKeys(obj: any): string[] {
    return Object.keys(obj);
  }

  hasBuddyResponses(): boolean {
    return Object.keys(this.buddyResponses).length > 0;
  }

  triggerEmergency() {
    this.presentEmergencyConfirmation();
  }

  async presentEmergencyConfirmation() {
    this.clearEmergencyConfirmationTimer();
    this.emergencyConfirmationTimeLeft = 5;

    const alert = await this.alertController.create({
      header: 'EMERGENCY ALERT!',
      message: `Your emergency alert is about to be sent. Are you sure?\n\nAuto-sending in: ${this.emergencyConfirmationTimeLeft}s`,
      buttons: [
        {
          text: 'SEND ALERT',
          handler: () => {
            this.clearEmergencyConfirmationTimer();
            this.sendEmergencyAlert();
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => { this.clearEmergencyConfirmationTimer(); }
        }
      ]
    });

    await alert.present();
    this.startEmergencyConfirmationTimer(alert);
  }

  private startEmergencyConfirmationTimer(alert: any) {
    this.emergencyConfirmationTimer = setInterval(() => {
      this.emergencyConfirmationTimeLeft--;

      const messageElement = document.querySelector('ion-alert .alert-message');
      if (messageElement) {
        messageElement.textContent = `Your emergency alert is about to be sent. Are you sure?\n\nAuto-sending in: ${this.emergencyConfirmationTimeLeft}s`;
      }

      if (this.emergencyConfirmationTimeLeft <= 0) {
        this.clearEmergencyConfirmationTimer();
        alert.dismiss();
        this.sendEmergencyAlert();
      }
    }, 1000);
  }

  private clearEmergencyConfirmationTimer() {
    if (this.emergencyConfirmationTimer) {
      clearInterval(this.emergencyConfirmationTimer);
      this.emergencyConfirmationTimer = null;
    }
  }

  async showResponderAlert(response: any) {
    await this.openResponderDashboardModal(response);
  }

  private async openResponderDashboardModal(payload: any) {
    this.router.navigate(['/tabs/responder-dashboard'], { state: { emergencyData: payload } });
  }

  async openResponderMap(response: any) {
    const data = response || this.minimizedResponder;
    if (!data || !data.emergencyId) return;

    await this.router.navigate(['/tabs/patient-map'], {
      state: { emergencyId: data.emergencyId, responderName: data.responderName || 'Responder' }
    });
  }

  dismissToMinimized() {
    this.minimizedResponder = this.respondingBuddy;
    this.respondingBuddy = null;
  }

  restoreResponder() {
    this.respondingBuddy = this.minimizedResponder;
    this.minimizedResponder = null;
  }

  dismissMinimized() {
    this.minimizedResponder = null;
  }

  openNotifications() {
    this.router.navigate(['/tabs/notification']);
  }

  openPollenMap() {
    this.router.navigate(['/tabs/pollen-map']);
  }

  getAllergensDisplay(): string {
    return this.userAllergies.map((a: any) => a.label || a.name).join(', ');
  }

  listenForNotificationStatus() {
    const statusSubscription = this.emergencyNotificationService.notificationStatus$.subscribe(status => {
      this.notificationStatus = { ...status };
      console.log('Notification status updated:', this.notificationStatus);
    });
    this.subscriptions.push(statusSubscription);
  }

  getNotificationStatus(buddyId: string): string {
    const status = this.notificationStatus[buddyId] || 'pending';
    switch (status) {
      case 'sending': return 'Sending...';
      case 'sent': return 'Notified';
      case 'failed': return 'Failed';
      default: return 'Pending...';
    }
  }

  getNotificationStatusColor(buddyId: string): string {
    const status = this.notificationStatus[buddyId] || 'pending';
    switch (status) {
      case 'sending': return 'warning';
      case 'sent': return 'success';
      case 'failed': return 'danger';
      default: return 'medium';
    }
  }

  shouldShowNotificationBadge(buddyId: string): boolean {
    const response = this.buddyResponses[buddyId];
    if (!response) return true;
    return response.status !== 'cannot_respond';
  }

  shouldShowHotlineFallback(): boolean {
    if (!this.isEmergencyActive) return false;
    if (this.userBuddies.length === 0) return true;

    const ids = Object.keys(this.buddyResponses);
    if (ids.length === 0) return false;

    return ids.every(id => this.buddyResponses[id] && this.buddyResponses[id].status === 'cannot_respond');
  }

  callNumber(number: string) {
    try {
      window.open(`tel:${number}`, '_system');
    } catch {
      window.open(`tel:${number}`);
    }
  }

  async sendEmergencyAlert() {
    const loading = await this.loadingController.create({
      message: 'Sending emergency alert...',
      duration: 15000
    });
    await loading.present();

    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) throw new Error('User not authenticated');

      const latestMedical = await this.medicalService.getUserMedicalProfile(currentUser.uid);
      const latestMessageInstruction = (latestMedical as any)?.emergencyMessage?.instructions;
      const resolvedInstruction =
        (typeof latestMessageInstruction === 'string' && latestMessageInstruction.trim()) ||
        latestMedical?.generalInstruction?.trim() ||
        this.emergencyInstruction ||
        '';

      this.emergencyInstruction = resolvedInstruction;

      const buddyIds = Array.from(new Set(
        this.userBuddies
          .map(buddy => buddy.connectedUserId)
          .filter(id => !!id && id !== currentUser.uid)
      ));
      const hasBuddies = buddyIds.length > 0;

      const allergyStrings = this.userAllergies
        .map((allergy: any) => allergy.label || allergy.name || '')
        .filter((allergy: string) => allergy !== '');

      console.log('Sending emergency alert with auto notifications...');

      this.currentEmergencyId = await this.emergencyService.sendEmergencyAlert(
        currentUser.uid,
        this.userName,
        buddyIds,
        allergyStrings,
        resolvedInstruction
      );

      this.isEmergencyActive = true;
      this.emergencyStartTime = new Date();
      this.buddyResponses = {};

      if (hasBuddies) {
        this.userBuddies.forEach(buddy => {
          const key = buddy.connectedUserId || buddy.id;
          if (!key || key === currentUser.uid) return;
          this.buddyResponses[key] = {
            status: 'sent',
            timestamp: new Date(),
            name: buddy.firstName + ' ' + buddy.lastName
          };
        });
      }

      try {
        const position = await this.emergencyService.getCurrentLocation();
        this.emergencyLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (locationError) {
        console.warn('Location unavailable, alert sent without precise location.');
      }

      await loading.dismiss();

      if (hasBuddies) {
        await this.presentToast(`Emergency alert sent to ${buddyIds.length} connections. Notifications are being delivered.`);
      } else {
        await this.presentToast('No emergency contacts available. Please contact emergency services.');
        await this.callEmergencyHotlines();
      }

      console.log('Emergency alert process completed successfully');

    } catch (error) {
      await loading.dismiss();
      console.error('Error sending emergency alert:', error);
      await this.presentToast('Failed to send emergency alert. Please try again.');
    }
  }

  async callEmergencyHotlines() {
    const alert = await this.alertController.create({
      header: 'No Emergency Contacts',
      message: 'No buddies are available. You can contact emergency services directly instead.',
      buttons: [
        { text: 'Call 911', handler: () => { window.open('tel:911'); } },
        { text: 'Call 117', handler: () => { window.open('tel:117'); } },
        { text: 'Call Red Cross 143', handler: () => { window.open('tel:143'); } },
        { text: 'Cancel', role: 'cancel' }
      ]
    });
    await alert.present();
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }

  getAllergensCount(): number {
    return this.userAllergies?.length || 0;
  }

  getBuddiesCount(): number {
    return this.userBuddies?.length || 0;
  }

  async checkBuddyStatus() {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      const ref = doc(this.db, 'users', currentUser.uid, 'medical', 'info');
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        this.hasBuddy = false;
        this.showBuddyBanner = false;
        return;
      }

      const data = snap.data();
      const setup = data?.['buddySetupOnboarding'];

      const hasRealBuddy = !!(setup?.primaryBuddy?.buddyUid) &&
                           setup?.primaryBuddy?.inviteStatus !== 'skipped';
      const usedFallback = setup?.fallbackUsed === true;
      const skipped = setup?.skippedBuddySetup === true;

      this.hasBuddy = hasRealBuddy;
      this.showBuddyBanner = (usedFallback || skipped) && !hasRealBuddy;
    } catch (error) {
      console.error('Error checking buddy status:', error);
    }
  }
}