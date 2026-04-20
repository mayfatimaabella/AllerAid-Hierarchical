import { Component, OnInit, OnDestroy } from '@angular/core';
import { ToastController, AlertController, LoadingController, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BuddyService } from '../../../core/services/buddy.service';
import { EmergencyService } from '../../../core/services/emergency.service';
import { EmergencyNotificationService } from '../../../core/services/emergency-notification.service';
import { UserService } from '../../../core/services/user.service';
import { AllergyService } from '../../../core/services/allergy.service';
import { Subscription } from 'rxjs';

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
  
  // Emergency tracking
  isEmergencyActive: boolean = false;
  emergencyStartTime: Date | null = null;
  buddyResponses: { [buddyId: string]: { status: string; timestamp: Date; name: string } } = {};
  private buddyStatusHistory: { [buddyId: string]: string } = {};
  emergencyLocation: { latitude: number; longitude: number } | null = null;
  emergencyAddress: string = '';
  isEmergencyAddressLoading: boolean = false;
  
  // Notification status tracking
  notificationStatus: { [buddyId: string]: 'sending' | 'sent' | 'failed' | 'pending' } = {};
  
  // Emergency confirmation timer
  private emergencyConfirmationTimer: any = null;
  emergencyConfirmationTimeLeft: number = 5;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private modalController: ModalController,
    private router: Router,
    private authService: AuthService,
    private buddyService: BuddyService,
    private emergencyService: EmergencyService,
    private emergencyNotificationService: EmergencyNotificationService,
    private userService: UserService,
    private allergyService: AllergyService,
  // private ehrService: EHRService
  ) {}

  async ngOnInit() {
    await this.loadUserData();
    this.listenForEmergencyResponses();
    this.listenForNotificationStatus();
    this.subscribeToUserEmergency();
  }

  async ionViewWillEnter() {
    // Refresh data every time the user comes back to this page
    await this.loadUserData();
    this.subscribeToUserEmergency();
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Clean up emergency confirmation timer
    this.clearEmergencyConfirmationTimer();
  }

  async loadUserData() {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (currentUser) {
        // Load user profile
        const userProfile = await this.userService.getUserProfile(currentUser.uid);
        if (userProfile) {
          this.userName = userProfile.fullName || 'User';
          const messageInstruction = (userProfile as any)?.emergencyMessage?.instructions;
          this.emergencyInstruction =
            (typeof messageInstruction === 'string' && messageInstruction.trim()) ||
            userProfile.emergencyInstruction ||
            '';
        }

        // Load user buddies
        this.userBuddies = await this.buddyService.getUserBuddies(currentUser.uid);
        
        // Load user allergies using the same logic as profile page
        const userAllergyDocs = await this.allergyService.getUserAllergies(currentUser.uid);
        this.userAllergies = [];
        
        // Flatten the allergies from documents and filter only checked ones
        userAllergyDocs.forEach((allergyDoc: any) => {
          if (allergyDoc.allergies && Array.isArray(allergyDoc.allergies)) {
            // Only include allergies that are checked
            const checkedAllergies = allergyDoc.allergies.filter((allergy: any) => allergy.checked);
            this.userAllergies.push(...checkedAllergies);
          }
        });

        // Listen for emergency responses
        this.listenForEmergencyResponses();

        // Also subscribe to user's emergency to resolve address
        this.subscribeToUserEmergency();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  listenForEmergencyResponses() {
    if (!this.currentEmergencyId) return;
    
    // Listen for emergency responses using the existing emergency service
    const responseSubscription = this.emergencyService.emergencyResponse$.subscribe(response => {
      if (response) {
        // Update buddy response tracking
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

  /**
   * Subscribe to the user's own emergency document and reflect responder status in UI.
   */
  private subscribeToUserEmergency() {
    const sub = this.emergencyService.userEmergency$.subscribe(async (emergency) => {
      if (!emergency) {
        // No active emergency document – clear local state
        this.clearEmergencyState();
        this.emergencyAddress = '';
        return;
      }

      // Track current emergency id for resolve actions
      this.currentEmergencyId = emergency.id || this.currentEmergencyId;

       // Ensure emergency status card is shown whenever the backend
       // reports a non-resolved emergency, even after app reload.
       this.isEmergencyActive = emergency.status !== 'resolved';

       // Derive start time from emergency timestamp if available
       if (emergency.timestamp && typeof (emergency.timestamp as any).toDate === 'function') {
         this.emergencyStartTime = (emergency.timestamp as any).toDate();
       }

      // Show responding banner when a buddy is en route
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
        // Clear all local emergency state when the backend marks it resolved
        this.clearEmergencyState();
        this.emergencyAddress = '';
      }

      // Sync per-buddy response statuses (including cannot_respond) from emergency document
      if (emergency.buddyResponses) {
        Object.keys(emergency.buddyResponses).forEach((buddyId) => {
          const responseInfo: any = (emergency.buddyResponses as any)[buddyId];
          if (!responseInfo || !responseInfo.status) {
            return;
          }

          const existing = this.buddyResponses[buddyId];
          const timestamp = responseInfo.timestamp && typeof (responseInfo.timestamp as any).toDate === 'function'
            ? (responseInfo.timestamp as any).toDate()
            : new Date();

          const previousStatus = this.buddyStatusHistory[buddyId];
          this.buddyStatusHistory[buddyId] = responseInfo.status;

          const displayName = responseInfo.name || (existing && existing.name) || 'Buddy';

          this.buddyResponses[buddyId] = {
            status: responseInfo.status,
            timestamp,
            name: displayName
          };

          // If this buddy has just changed to cannot_respond, inform the user
          if (responseInfo.status === 'cannot_respond' && previousStatus !== 'cannot_respond') {
            this.presentToast(`${displayName} cannot respond to your emergency right now.`);
          }
        });
      }

      // Update emergency location and resolve to human-readable address
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
  
  /**
   * Clear emergency state when emergency is resolved
   */
  clearEmergencyState() {
    this.isEmergencyActive = false;
    this.emergencyStartTime = null;
    this.currentEmergencyId = null;
    this.buddyResponses = {};
    this.emergencyLocation = null;
    this.respondingBuddy = null;
    this.minimizedResponder = null;
  }
  
  /**
   * Manually resolve the emergency
   */
  async resolveEmergency() {
    if (!this.currentEmergencyId) return;
    
    const alert = await this.alertController.create({
      header: 'Resolve Emergency',
      message: 'Are you sure you want to mark this emergency as resolved?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
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
  
  /**
   * Get buddy response status display text
   */
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
  
  /**
   * Get buddy response color based on status
   */
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
  
  /**
   * Get object keys helper for template
   */
  getObjectKeys(obj: any): string[] {
    return Object.keys(obj);
  }
  
  /**
   * Check if buddy responses object has entries
   */
  hasBuddyResponses(): boolean {
    return Object.keys(this.buddyResponses).length > 0;
  }

  triggerEmergency() {
    this.presentEmergencyConfirmation();
  }

  async presentEmergencyConfirmation() {
    // Reset timer to 5 seconds
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
          handler: () => {
            this.clearEmergencyConfirmationTimer();
          }
        }
      ]
    });

    await alert.present();

    // Start the countdown timer
    this.startEmergencyConfirmationTimer(alert);
  }

  /**
   * Start the emergency confirmation timer.
   * Auto-sends alert when timer reaches 0.
   */
  private startEmergencyConfirmationTimer(alert: any) {
    this.emergencyConfirmationTimer = setInterval(() => {
      this.emergencyConfirmationTimeLeft--;

      // Update the alert message with the current countdown
      const messageElement = document.querySelector('ion-alert .alert-message');
      if (messageElement) {
        messageElement.textContent = `Your emergency alert is about to be sent. Are you sure?\n\nAuto-sending in: ${this.emergencyConfirmationTimeLeft}s`;
      }

      if (this.emergencyConfirmationTimeLeft <= 0) {
        this.clearEmergencyConfirmationTimer();
        alert.dismiss(); // Close the alert
        this.sendEmergencyAlert();
      }
    }, 1000);
  }

  /**
   * Clear and reset the emergency confirmation timer.
   */
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
    this.router.navigate(['/tabs/responder-dashboard'], {
      state: { emergencyData: payload }
    });
  }
  
  async openResponderMap(response: any) {
    // Patient view: navigate to passive patient map that tracks responder
    const data = response || this.minimizedResponder;
    if (!data || !data.emergencyId) {
      return;
    }

    await this.router.navigate(['/tabs/patient-map'], {
      state: {
        emergencyId: data.emergencyId,
        responderName: data.responderName || 'Responder'
      }
    });
  }

  /**
   * Dismiss the full notification but keep a minimized chip so the map stays accessible.
   */
  dismissToMinimized() {
    this.minimizedResponder = this.respondingBuddy;
    this.respondingBuddy = null;
  }

  /**
   * Restore the full notification from the minimized chip.
   */
  restoreResponder() {
    this.respondingBuddy = this.minimizedResponder;
    this.minimizedResponder = null;
  }

  /**
   * Fully dismiss the minimized chip.
   */
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
  
  getBuddiesCount(): string {
    return `${this.userBuddies.length}`;
  }
  
  /**
   * Listen for notification status updates
   */
  listenForNotificationStatus() {
    const statusSubscription = this.emergencyNotificationService.notificationStatus$.subscribe(status => {
      this.notificationStatus = { ...status };
      console.log('Notification status updated:', this.notificationStatus);
    });
    
    this.subscriptions.push(statusSubscription);
  }
  
  /**
   * Get notification status for a buddy
   */
  getNotificationStatus(buddyId: string): string {
    const status = this.notificationStatus[buddyId] || 'pending';
    switch (status) {
      case 'sending': return 'Sending...';
      case 'sent': return 'Notified';
      case 'failed': return 'Failed';
      default: return 'Pending...';
    }
  }
  
  /**
   * Get notification status color
   */
  getNotificationStatusColor(buddyId: string): string {
    const status = this.notificationStatus[buddyId] || 'pending';
    switch (status) {
      case 'sending': return 'warning';
      case 'sent': return 'success';
      case 'failed': return 'danger';
      default: return 'medium';
    }
  }

  /**
   * Only show the notification badge while we are still waiting
   * on delivery/notification status. Once a buddy has explicitly
   * responded that they cannot respond, hide the extra "Pending" badge
   * to avoid showing "Cannot Respond Pending..." together.
   */
  shouldShowNotificationBadge(buddyId: string): boolean {
    const response = this.buddyResponses[buddyId];
    if (!response) {
      return true;
    }

    // Hide notification badge when buddy has marked cannot_respond
    return response.status !== 'cannot_respond';
  }

  /**
   * Determine when to show hotline fallback actions on the emergency card.
   * - No buddies at all → show
   * - All buddies that have responded are in cannot_respond status → show
   */
  shouldShowHotlineFallback(): boolean {
    if (!this.isEmergencyActive) {
      return false;
    }

    // No buddies configured
    if (this.userBuddies.length === 0) {
      return true;
    }

    const ids = Object.keys(this.buddyResponses);
    if (ids.length === 0) {
      return false;
    }

    // Show fallback when every tracked buddy response is cannot_respond
    return ids.every(id => this.buddyResponses[id] && this.buddyResponses[id].status === 'cannot_respond');
  }

  /**
   * Simple helper to trigger a phone call to a given number.
   */
  callNumber(number: string) {
    try {
      window.open(`tel:${number}`, '_system');
    } catch {
      window.open(`tel:${number}`);
    }
  }
  
  /**
   * Enhanced emergency alert with auto notifications
   */
  async sendEmergencyAlert() {
    const loading = await this.loadingController.create({
      message: 'Sending emergency alert...',
      duration: 15000 // 15 seconds max
    });
    await loading.present();

    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Resolve latest emergency instruction right before sending
      const latestProfile = await this.userService.getUserProfile(currentUser.uid);
      const latestMessageInstruction = (latestProfile as any)?.emergencyMessage?.instructions;
      const latestLegacyInstruction = latestProfile?.emergencyInstruction;
      const resolvedInstruction =
        (typeof latestMessageInstruction === 'string' && latestMessageInstruction.trim()) ||
        (typeof latestLegacyInstruction === 'string' && latestLegacyInstruction.trim()) ||
        (this.emergencyInstruction || '');

      this.emergencyInstruction = resolvedInstruction;

      // Get unique connected user IDs (actual recipient user IDs), exclude self
      const buddyIds = Array.from(new Set(
        this.userBuddies
          .map(buddy => buddy.connectedUserId)
          .filter(id => !!id && id !== currentUser.uid)
      ));
      const hasBuddies = buddyIds.length > 0;
      
      // Get allergy strings
      const allergyStrings = this.userAllergies.map((allergy: any) => 
        allergy.label || allergy.name || ''
      ).filter((allergy: string) => allergy !== '');
      
      console.log('Sending emergency alert with auto notifications...');
      
      // Send the emergency alert (this will automatically trigger SMS and push notifications)
      this.currentEmergencyId = await this.emergencyService.sendEmergencyAlert(
        currentUser.uid,
        this.userName,
        buddyIds,
        allergyStrings,
        resolvedInstruction
      );
      
      // Set emergency state
      this.isEmergencyActive = true;
      this.emergencyStartTime = new Date();
      this.buddyResponses = {};
      
      // Initialize buddy response tracking with notification status keyed by connected user id
      if (hasBuddies) {
        this.userBuddies.forEach(buddy => {
          const key = buddy.connectedUserId || buddy.id;
          if (!key || key === currentUser.uid) { return; }
          this.buddyResponses[key] = {
            status: 'sent',
            timestamp: new Date(),
            name: buddy.firstName + ' ' + buddy.lastName
          };
        });
      }
      
      // Get current location for display (graceful fallback)
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
      
      // Show success message and, when no buddies, recommend hotlines
      if (hasBuddies) {
        await this.presentToast(
          `Emergency alert sent to ${buddyIds.length} connections. Notifications are being delivered.`
        );
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

  /**
   * Fallback when no buddies are available: suggest emergency hotlines.
   */
  async callEmergencyHotlines() {
    const alert = await this.alertController.create({
      header: 'No Emergency Contacts',
      message: 'No buddies are available. You can contact emergency services directly instead.',
      buttons: [
        {
          text: 'Call 911',
          handler: () => {
            window.open('tel:911');
          }
        },
        {
          text: 'Call 117',
          handler: () => {
            window.open('tel:117');
          }
        },
        {
          text: 'Call Red Cross 143',
          handler: () => {
            window.open('tel:143');
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
  
  /**
   * Test emergency notification system
   */
  // async testEmergencyNotifications() {
  //   try {
  //     const currentUser = await this.authService.waitForAuthInit();
  //     if (!currentUser) {
  //       throw new Error('User not authenticated');
  //     }

  //     const userProfile = await this.userService.getUserProfile(currentUser.uid);
  //     if (!userProfile) {
  //       throw new Error('User profile not found');
  //     }

  //     await this.emergencyNotificationService.testNotificationSystem(userProfile);
  //     await this.presentToast('Test notification sent! Check console for details.');
      
  //   } catch (error) {
  //     console.error('Test notification failed:', error);
  //     await this.presentToast('Test notification failed. Check console for details.');
  //   }
  // }
  
  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }
}







