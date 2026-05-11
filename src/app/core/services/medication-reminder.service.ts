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
  private maxOccurrences = 8; 
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
    } catch (error) {
      console.error('Error registering notification actions:', error);
    }
  }

  async ensurePermissions() {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  }

  private hashId(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  private nextTimes(start?: Date, end?: Date, intervalHours?: number): Date[] {
    const out: Date[] = [];
    if (!start || !intervalHours) return out;

    const now = new Date();
    // FIX: Multiply by 60 twice to convert hours to milliseconds
    const stepMs = intervalHours * 60 * 60 * 1000; 

    const endBoundary = end ? new Date(new Date(end).setHours(23, 59, 59, 999)) : undefined;

    let first: Date;
    if (now <= start) {
      first = new Date(start);
    } else {  
      const diff = now.getTime() - start.getTime();     
      const steps = Math.ceil(diff / stepMs);           
      first = new Date(start.getTime() + steps * stepMs); 
    }

    let cur = first;
    while ((!endBoundary || cur <= endBoundary) && out.length < this.maxOccurrences) {
      out.push(new Date(cur));
      cur = new Date(cur.getTime() + stepMs);
    }
    return out;
  }

  private calculateRemainingPills(med: any): number {
    if (!med?.startDate || med?.quantity === undefined || !med?.intervalHours) {
      return med?.quantity ?? 0;
    }

    const start = new Date(med.startDate);
    const now = new Date();
    if (now < start) return med.quantity;

    // Calculate how many intervals have passed since start
    const stepMs = med.intervalHours * 60 * 60 * 1000;
    const timeElapsedMs = now.getTime() - start.getTime();
    
    // We add 1 because the first pill is taken exactly at the start time
    const dosesDeducted = Math.floor(timeElapsedMs / stepMs) + 1;

    return Math.max(med.quantity - dosesDeducted, 0);
  }

  async scheduleForMedication(med: any) {
    if (!med?.id) return;
    await this.ensurePermissions();

    const start = med?.startDate ? new Date(med.startDate) : new Date();
    const end = med?.expiryDate ? new Date(med.expiryDate) : undefined;
    const interval = Number(med?.intervalHours) || 0;

    const remaining = this.calculateRemainingPills(med);

    // Stop scheduling if inactive or out of pills
    if (!interval || med?.isActive === false || remaining <= 0) {
      await this.cancelForMedication(med.id);
      return;
    }

    const baseId = this.hashId(med.id);
    const times = this.nextTimes(start, end, interval);

    // Clear old schedules before adding new ones
    await this.cancelForMedication(med.id);

    const notifications: ScheduleOptions['notifications'] = times.map((at, i) => ({
      id: baseId + i,
      title: `${med.name}: Time to take`,
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

  startListeningForNotifications(): void {
    if (this.isListeningToNotifications) return;
    this.isListeningToNotifications = true;

    LocalNotifications.addListener('localNotificationReceived', (event: any) => {
      const notification: LocalNotification = event.notification;
      const medNotif: MedicationNotification = {
        id: notification.id || 0,
        title: notification.title || '',
        body: notification.body || '',
        medId: (notification.extra as any)?.medId || '',
        occurrence: (notification.extra as any)?.occurrence || 0
      };
      this.medicationNotification$.next(medNotif);
      this.handleMedicationNotificationReceived(medNotif);
    });

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
      this.medicationNotification$.next(medNotif);
      this.handleMedicationNotificationAction(medNotif, actionId);
    });
  }

  stopListeningForNotifications(): void {
    if (!this.isListeningToNotifications) return;
    try {
      LocalNotifications.removeAllListeners();
      this.isListeningToNotifications = false;
    } catch (error) {
      console.error('Error stopping listener:', error);
    }
  }

  getMedicationNotifications$(): Observable<MedicationNotification | null> {
    return this.medicationNotification$.asObservable();
  }

  private async handleMedicationNotificationReceived(notification: MedicationNotification): Promise<void> {
    console.log(`Reminder received for: ${notification.title}`);
  }

  private async handleMedicationNotificationAction(notification: MedicationNotification, actionId?: string): Promise<void> {
    try {
      if (!notification.medId) return;

      if (actionId === 'TAKEN') {
        const result = await this.medicationService.recordReminderAction(notification.medId, 'taken');
        const newQuantity = (result as any)?.newQuantity;
        if (typeof newQuantity === 'number' && newQuantity <= 0) {
          await this.cancelForMedication(notification.medId);
        }
      } else if (actionId === 'SKIP') {
        await this.medicationService.recordReminderAction(notification.medId, 'skipped');
      } else {
        await this.medicationService.recordReminderAction(notification.medId, 'opened');
      }
    } catch (error) {
      console.error('Error handling action:', error);
    }
  }

  private setupAppStateListeners(): void {
    App.addListener('appStateChange', async (state) => {
      if (state.isActive) {
        await this.syncBackgroundMedicationEvents();
      }
    });
  }

  private async syncBackgroundMedicationEvents(): Promise<void> {
    try {
      const events = await this.retrieveBackgroundMedicationEvents();
      if (events && events.length > 0) {
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
        this.backgroundEvents$.next(events);
        await this.clearBackgroundMedicationEvents();
      }
    } catch (error) {
      console.error('Error syncing events:', error);
    }
  }

  private async retrieveBackgroundMedicationEvents(): Promise<BackgroundMedicationEvent[]> {
    return [];
  }

  private async clearBackgroundMedicationEvents(): Promise<void> {
    // Logic to clear native store
  }

  getBackgroundMedicationEvents$(): Observable<BackgroundMedicationEvent[]> {
    return this.backgroundEvents$.asObservable();
  }

  async triggerBackgroundEventSync(): Promise<void> {
    await this.syncBackgroundMedicationEvents();
  }
}