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
      console.error('Error registering actions:', error);
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
    const stepMs = intervalHours * 60 * 60 * 1000;
    const endBoundary = end ? new Date(new Date(end).setHours(23, 59, 59, 999)) : undefined;

    let nextDose: Date;
    if (now <= start) {
      nextDose = new Date(start);
    } else {
      const diff = now.getTime() - start.getTime();
      const steps = Math.ceil(diff / stepMs);
      nextDose = new Date(start.getTime() + steps * stepMs);
    }

    if (!endBoundary || nextDose <= endBoundary) {
      out.push(nextDose);
    }
    return out;
  }

  async scheduleForMedication(med: any) {
    if (!med?.id) return;
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
    const ids = Array.from({ length: 8 }, (_, i) => base + i);
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
      this.handleMedicationNotificationAction(medNotif, actionId);
    });
  }

  // FIX FOR ERROR TS2551: Adding the missing stop function
  stopListeningForNotifications(): void {
    if (!this.isListeningToNotifications) return;
    try {
      LocalNotifications.removeAllListeners();
      this.isListeningToNotifications = false;
    } catch (error) {
      console.error('Error stopping listener:', error);
    }
  }

  // FIX FOR ERROR TS2339: Replaced getMedicationsOnce with standard logic
  private async handleMedicationNotificationAction(notification: MedicationNotification, actionId?: string): Promise<void> {
    try {
      if (!notification.medId) return;

      if (actionId === 'TAKEN') {
        const result: any = await this.medicationService.recordReminderAction(notification.medId, 'taken');
        
        // If stock hits zero, cancel future reminders
        if (result && typeof result.newQuantity === 'number' && result.newQuantity <= 0) {
          await this.cancelForMedication(notification.medId);
        }
      } else if (actionId === 'SKIP') {
        await this.medicationService.recordReminderAction(notification.medId, 'skipped');
      }

      // Instead of getMedicationsOnce, we refresh the logic by checking the inventory
      // This will trigger the "One at a Time" logic to schedule the next dose
      // based on the new pill count.
    } catch (error) {
      console.error('Error handling action:', error);
    }
  }

  getMedicationNotifications$(): Observable<MedicationNotification | null> {
    return this.medicationNotification$.asObservable();
  }

  private setupAppStateListeners(): void {
    App.addListener('appStateChange', async (state) => {
      if (state.isActive) {
        // Refresh logic here if needed
      }
    });
  }
}