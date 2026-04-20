import { Injectable } from '@angular/core';
import { LocalNotifications, ScheduleOptions, LocalNotification } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { BehaviorSubject, Observable } from 'rxjs';
import { MedicationService } from './medication.service';

export interface MedicationNotification {
  id: number;
  title: string;
  body: string;
  medId: string;
  occurrence: number;
}

export interface BackgroundMedicationEvent {
  medId: string;
  title: string;
  body: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class MedicationReminderService {
  private maxOccurrences = 8; // schedule a few upcoming alerts
  private medicationNotification$ = new BehaviorSubject<MedicationNotification | null>(null);
  private backgroundEvents$ = new BehaviorSubject<BackgroundMedicationEvent[]>([]);
  private isListeningToNotifications = false;

  constructor(private medicationService: MedicationService) {
    this.setupAppStateListeners();
    this.registerNotificationActions();
  }

  private async registerNotificationActions(): Promise<void> {
    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'MED_TAKE_OR_SKIP',
            actions: [
              { id: 'TAKEN', title: 'Taken' },
              { id: 'SKIP', title: 'Skip' }
            ]
          }
        ]
      });
      console.log('Medication notification actions registered');
    } catch (error) {
      console.error('Error registering medication notification actions:', error);
    }
  }

  async ensurePermissions() {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  }

  //id for each scheduled notification
  private hashId(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
                                                                    //result array maoy i return
  private nextTimes(start?: Date, end?: Date, intervalHours?: number): Date[] {
    const out: Date[] = [];
    //no start time and no interval provided walay i schedule
    if (!start || !intervalHours) return out;

    //get unsay date karun 
    const now = new Date();
    // TESTING: treat interval value as MINUTES instead of hours
    const stepMs = intervalHours * 60 * 1000;  // convert minutes to milliseconds

    const endBoundary = end ? new Date(new Date(end).setHours(23, 59, 59, 999)) : undefined; //gi set ug end of the day ang provided date

    let first: Date;
    if (now <= start) first = new Date(start); //if wala pa ang start ang date, ang "start" date ang first
    else {  
      const diff = now.getTime() - start.getTime();     //pila na ka oras gikan start time 
      const steps = Math.ceil(diff / stepMs);           //pila na ka oras ang nilabay gikan start time
      first = new Date(start.getTime() + steps * stepMs); //kuhaon ang sunod nga reminder
    }

    let cur = first;
    while ((!endBoundary || cur <= endBoundary) && out.length < this.maxOccurrences) {
      out.push(new Date(cur));
      cur = new Date(cur.getTime() + stepMs);
    }
    return out;
  }

  // Mirror the UI logic for remaining pills so that
  // notifications stop once a course is effectively finished.
  private calculateRemainingPills(med: any): number {
    if (!med?.startDate || med?.quantity === undefined) {
      return med?.quantity ?? 0;
    }

    const start = new Date(med.startDate);
    const today = new Date();
    if (today < start) return med.quantity;

    const daysElapsed = Math.floor((today.getTime() - start.getTime()) / (1000 * 3600 * 24));

    let dosesPerDay = 1;
    if (typeof med.frequency === 'string') {
      const match = med.frequency.match(/(\d+)/);
      if (match) {
        dosesPerDay = parseInt(match[1], 10);
      } else if (med.frequency.toLowerCase().includes('twice')) {
        dosesPerDay = 2;
      } else if (med.frequency.toLowerCase().includes('thrice')) {
        dosesPerDay = 3;
      }
    }

    const deducted = daysElapsed * dosesPerDay;
    return Math.max(med.quantity - deducted, 0);
  }

  async scheduleForMedication(med: any) {
    if (!med?.id) return;
    await this.ensurePermissions();

    const start = med?.startDate ? new Date(med.startDate) : new Date();
    const end = med?.expiryDate ? new Date(med.expiryDate) : undefined;
    const interval = Number(med?.intervalHours) || 0;

    const remaining = this.calculateRemainingPills(med);

    // If there is no interval, the medication is inactive, or
    // there are effectively no pills left, cancel any existing
    // reminders and do not schedule new ones.
    if (!interval || med?.isActive === false || remaining <= 0) {
      await this.cancelForMedication(med.id);
      return;
    }

    const baseId = this.hashId(med.id);
    const times = this.nextTimes(start, end, interval);

    await this.cancelForMedication(med.id);

    const notifications: ScheduleOptions['notifications'] = times.map((at, i) => ({
      id: baseId + i,
      title: `${med.name}: time to take`,
      body: `Dose due at ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      schedule: { at },
      actionTypeId: 'MED_TAKE_OR_SKIP',
      extra: { medId: med.id, occurrence: i }
    }));

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }
  }

  async cancelForMedication(medId: string) {
    const base = this.hashId(medId);
    const ids = Array.from({ length: this.maxOccurrences }, (_, i) => base + i);
    await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
  }

  async rescheduleAll(meds: any[]) {
    for (const m of meds ?? []) {
      await this.scheduleForMedication(m);
    }
  }

  /**
   * Start listening for medication notification events
   */
  startListeningForNotifications(): void {
    if (this.isListeningToNotifications) {
      console.log('Already listening to medication notifications');
      return;
    }

    this.isListeningToNotifications = true;
    console.log('Starting to listen for medication notifications');

    // Listen for when notification is received (while app is open or running in background)
    LocalNotifications.addListener('localNotificationReceived', (event: any) => {
      const notification: LocalNotification = event.notification;
      const medNotif: MedicationNotification = {
        id: notification.id || 0,
        title: notification.title || '',
        body: notification.body || '',
        medId: (notification.extra as any)?.medId || '',
        occurrence: (notification.extra as any)?.occurrence || 0
      };
      console.log('Medication notification received:', medNotif);
      this.medicationNotification$.next(medNotif);
      this.handleMedicationNotificationReceived(medNotif);
    });

    // Listen for when user interacts with the notification
    LocalNotifications.addListener('localNotificationActionPerformed', (event: any) => {
      const notification: LocalNotification = event.notification;
      const actionId: string | undefined = (event as any)?.actionId;
      const medNotif: MedicationNotification = {
        id: notification.id || 0,
        title: notification.title || '',
        body: notification.body || '',
        medId: (notification.extra as any)?.medId || '',
        occurrence: (notification.extra as any)?.occurrence || 0
      };
      console.log('Medication notification action performed:', medNotif, 'actionId:', actionId);
      this.medicationNotification$.next(medNotif);
      this.handleMedicationNotificationAction(medNotif, actionId);
    });
  }

  /**
   * Stop listening for medication notification events
   */
  stopListeningForNotifications(): void {
    if (!this.isListeningToNotifications) {
      return;
    }

    try {
      LocalNotifications.removeAllListeners();
      this.isListeningToNotifications = false;
      console.log('Stopped listening for medication notifications');
    } catch (error) {
      console.error('Error stopping medication notification listener:', error);
    }
  }

  /**
   * Get observable of medication notifications
   */
  getMedicationNotifications$(): Observable<MedicationNotification | null> {
    return this.medicationNotification$.asObservable();
  }

  /**
   * Handle medication notification when received
   */
  private async handleMedicationNotificationReceived(notification: MedicationNotification): Promise<void> {
    try {
      console.log(`Medication reminder received: ${notification.title}`);
      // You can add logic here such as:
      // - Update medication status
      // - Log notification event
      // - Trigger additional actions
    } catch (error) {
      console.error('Error handling medication notification:', error);
    }
  }

  /**
   * Handle medication notification when user interacts with it
   */
  private async handleMedicationNotificationAction(notification: MedicationNotification, actionId?: string): Promise<void> {
    try {
      if (!notification.medId) {
        console.log('Medication notification action with no medId; ignoring');
        return;
      }

      if (actionId === 'TAKEN') {
        console.log(`Medication taken confirmed for medId=${notification.medId}`);
        const result = await this.medicationService.recordReminderAction(notification.medId, 'taken');

        // If pills are finished (quantity <= 0), stop any
        // future scheduled reminders for this medication.
        const newQuantity = (result as any)?.newQuantity;
        if (typeof newQuantity === 'number' && newQuantity <= 0) {
          console.log(`No pills remaining for medId=${notification.medId}; cancelling future reminders.`);
          await this.cancelForMedication(notification.medId);
        }
      } else if (actionId === 'SKIP') {
        console.log(`Medication skipped for medId=${notification.medId}`);
        await this.medicationService.recordReminderAction(notification.medId, 'skipped');
      } else {
        console.log(`User opened medication notification: ${notification.title}`);
        await this.medicationService.recordReminderAction(notification.medId, 'opened');
      }
    } catch (error) {
      console.error('Error handling medication notification action:', error);
    }
  }

  /**
   * Setup listeners for app state changes
   * This allows us to detect when the app resumes to check for missed background notifications
   */
  private setupAppStateListeners(): void {
    // Listen for app resume to sync background events
    App.addListener('appStateChange', async (state) => {
      if (state.isActive) {
        console.log('App resumed, checking for background medication events');
        await this.syncBackgroundMedicationEvents();
      }
    });
  }

  /**
   * Sync medication events that occurred while app was in background/closed
   * This retrieves events stored by the native BroadcastReceiver
   */
  private async syncBackgroundMedicationEvents(): Promise<void> {
    try {
      // Try to retrieve background events from native storage
      const events = await this.retrieveBackgroundMedicationEvents();
      
      if (events && events.length > 0) {
        console.log('Found background medication events:', events);
        
        // Emit each event through the notification stream
        for (const event of events) {
          const medNotif: MedicationNotification = {
            id: this.hashId(event.medId),
            title: event.title,
            body: event.body,
            medId: event.medId,
            occurrence: 0
          };
          
          this.medicationNotification$.next(medNotif);
          await this.handleMedicationNotificationAction(medNotif);
        }
        
        // Update background events observable
        this.backgroundEvents$.next(events);
        
        // Clear the native storage after syncing
        await this.clearBackgroundMedicationEvents();
      }
    } catch (error) {
      console.error('Error syncing background medication events:', error);
    }
  }

  /**
   * Retrieve medication events from native Android storage
   * These events were stored by the BroadcastReceiver when the app was closed
   */
  private async retrieveBackgroundMedicationEvents(): Promise<BackgroundMedicationEvent[]> {
    try {
      // This would use native storage access
      // For now, returning empty array - actual implementation would call native code directly
      // In a real scenario, you might use a Capacitor plugin or WebView integration
      
      console.log('Attempting to retrieve background medication events from native storage');
      
      // Placeholder: would retrieve from SharedPreferences on Android
      // const events = await this.nativeBridge.getMedicationEvents();
      
      return [];
    } catch (error) {
      console.error('Error retrieving background medication events:', error);
      return [];
    }
  }

  /**
   * Clear background medication events from native storage after retrieval
   */
  private async clearBackgroundMedicationEvents(): Promise<void> {
    try {
      console.log('Clearing background medication events from native storage');
      // This would clear SharedPreferences on Android
      // await this.nativeBridge.clearMedicationEvents();
    } catch (error) {
      console.error('Error clearing background medication events:', error);
    }
  }

  /**
   * Get observable of background medication events
   */
  getBackgroundMedicationEvents$(): Observable<BackgroundMedicationEvent[]> {
    return this.backgroundEvents$.asObservable();
  }

  /**
   * Manually trigger background event sync (for testing or force refresh)
   */
  async triggerBackgroundEventSync(): Promise<void> {
    await this.syncBackgroundMedicationEvents();
  }
}
