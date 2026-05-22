import { Injectable } from '@angular/core';
import { LocalNotifications, ScheduleOptions, LocalNotification, PendingResult } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { BehaviorSubject, Observable } from 'rxjs';
import { MedicationService } from 'src/app/core/services/medication.service'; 

export interface MedicationNotification {
  id: number;
  title: string;
  body: string;
  medId: string;
  occurrence: number;
}

@Injectable({ providedIn: 'root' })
export class MedicationReminderService {
  private maxOccurrences = 1; 
  private medicationNotification$ = new BehaviorSubject<MedicationNotification | null>(null);
  private isListeningToNotifications = false;

  constructor(private medicationService: MedicationService) {
    this.setupAppStateListeners();
    this.registerNotificationActions();
  }

  /**
   * Registers interactive 'Taken' and 'Skip' button actions with the mobile OS engine.
   */
  private async registerNotificationActions(): Promise<void> {
    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'MED_TAKE_OR_SKIP',
            actions: [
              { id: 'TAKEN', title: 'Taken', foreground: true },
              { id: 'SKIP', title: 'Skip', destructive: true }
            ]
          }
        ]
      });
    } catch (error) {
      console.error('Error registering notification action types:', error);
    }
  }

  /**
   * Requests device permissions for local alert deliveries if not already granted.
   */
  async ensurePermissions() {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  }

  /**
   * Generates a stable numeric hash from a string ID to manage OS notification groups.
   */
  private hashId(str: string): number {
    if (!str) return Math.floor(Math.random() * 100000);
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  /**
   * Calculates the very next future dose runtime parameters based on custom intervals.
   */
  private nextTimes(start?: Date, end?: Date, intervalHours?: number): Date[] {
    const out: Date[] = [];
    if (!start || !intervalHours) return out;

    const now = new Date();
    const stepMs = intervalHours * 60 * 60 * 1000;
    
    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) return out;

    const endBoundary = end ? new Date(new Date(end).setHours(23, 59, 59, 999)) : undefined;

    let nextDose: Date;
    if (now <= startDate) {
      nextDose = new Date(startDate);
    } else {
      const diff = now.getTime() - startDate.getTime();
      const steps = Math.ceil(diff / stepMs);
      nextDose = new Date(startDate.getTime() + steps * stepMs);
    }

    if (!endBoundary || nextDose <= endBoundary) {
      out.push(nextDose);
    }
    return out;
  }

  /**
   * Schedules a background alert for an individual medication row config profile.
   */
  async scheduleForMedication(med: any) {
    if (!med || !med.id) return;
    await this.ensurePermissions();

    const start = med?.startDate ? new Date(med.startDate) : new Date();
    const end = med?.expiryDate ? new Date(med.expiryDate) : undefined;
    const interval = Number(med?.intervalHours) || 0;

    if (!interval || med?.isActive === false || (med?.quantity ?? 0) <= 0) {
      await this.cancelForMedication(med.id);
      return;
    }

    const baseId = this.hashId(med.id);
    const times = this.nextTimes(start, end, interval);

    await this.cancelForMedication(med.id);

    const notifications: ScheduleOptions['notifications'] = times.map((at, i) => ({
      id: baseId + i,
      title: `${med.name || 'Medication'}: Time to take`,
      body: `Dose due at ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      schedule: { at },
      actionTypeId: 'MED_TAKE_OR_SKIP',
      extra: { medId: med.id, occurrence: i }
    }));

    if (notifications.length) {
      await LocalNotifications.schedule({ notifications });
    }
  }

  /**
   * Cleans pending operating system notification queues for a precise target medication id.
   */
  async cancelForMedication(medId: string) {
    if (!medId) return;
    const base = this.hashId(medId);
    const ids = Array.from({ length: 8 }, (_, i) => base + i);
    try {
      await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
    } catch (e) {
      console.error('Error canceling notifications:', e);
    }
  }

  /**
   * Loops over a collection of medications to sync and reschedule their reminders.
   */
  async rescheduleAll(meds: any[]) {
    for (const m of meds ?? []) {
      if (m && m.id) {
        await this.scheduleForMedication(m);
      }
    }
  }

  /**
   * Queries the native OS background alarm pool to populate items on the Reminders Tab.
   */
  async getPendingReminders(): Promise<any[]> {
    try {
      const pending: PendingResult = await LocalNotifications.getPending();
      
      return pending.notifications.map(notif => ({
        id: notif.id,
        title: notif.title,
        body: notif.body,
        scheduledAt: notif.schedule?.at ? new Date(notif.schedule.at) : null,
        medId: notif.extra?.medId || ''
      })).sort((a, b) => {
        const timeA = a.scheduledAt ? a.scheduledAt.getTime() : 0;
        const timeB = b.scheduledAt ? b.scheduledAt.getTime() : 0;
        return timeA - timeB;
      });
    } catch (error) {
      console.error('Failed to retrieve native pending notification array:', error);
      return [];
    }
  }

  /**
   * Starts listening to system event streams when notifications are received or clicked.
   */
  startListeningForNotifications(): void {
    if (this.isListeningToNotifications) return;
    this.isListeningToNotifications = true;

    LocalNotifications.addListener('localNotificationReceived', (event: any) => {
      if (!event || !event.notification) return;
      const notification: LocalNotification = event.notification;
      const medNotif: MedicationNotification = {
        id: notification.id || 0,
        title: notification.title || '',
        body: notification.body || '',
        medId: notification.extra?.medId || '',
        occurrence: notification.extra?.occurrence || 0
      };
      this.medicationNotification$.next(medNotif);
    });

    LocalNotifications.addListener('localNotificationActionPerformed', (event: any) => {
      if (!event || !event.notification) return;
      const notification: LocalNotification = event.notification;
      const actionId: string | undefined = event?.actionId;
      const medNotif: MedicationNotification = {
        id: notification.id || 0,
        title: notification.title || '',
        body: notification.body || '',
        medId: notification.extra?.medId || '',
        occurrence: notification.extra?.occurrence || 0
      };
      this.handleMedicationNotificationAction(medNotif, actionId);
    });
  }

  /**
   * Disables event listeners and clears system subscription hook registrations.
   */
  stopListeningForNotifications(): void {
    if (!this.isListeningToNotifications) return;
    try {
      LocalNotifications.removeAllListeners();
      this.isListeningToNotifications = false;
    } catch (error) {
      console.error('Error stopping notification listeners:', error);
    }
  }

  /**
   * Safely routes action responses ('TAKEN' / 'SKIP') without throwing property errors.
   */
  private async handleMedicationNotificationAction(notification: MedicationNotification | undefined | null, actionId?: string): Promise<void> {
    try {
      if (!notification || !notification.medId) {
        console.warn('Action captured, but payload metadata maps were empty.');
        return;
      }

      if (actionId === 'TAKEN') {
        const result: any = await this.medicationService.recordReminderAction(notification.medId, 'taken');
        
        if (result && typeof result.newQuantity === 'number' && result.newQuantity <= 0) {
          await this.cancelForMedication(notification.medId);
        }
      } else if (actionId === 'SKIP') {
        await this.medicationService.recordReminderAction(notification.medId, 'skipped');
      }
    } catch (error) {
      console.error('Error processing medication action handler targets:', error);
    }
  }

  getMedicationNotifications$(): Observable<MedicationNotification | null> {
    return this.medicationNotification$.asObservable();
  }

  private setupAppStateListeners(): void {
    App.addListener('appStateChange', async (state) => {
      if (state.isActive) {
        // App returned from background context fallback hook
      }
    });
  }
}