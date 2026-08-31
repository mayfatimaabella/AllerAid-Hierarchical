import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { LocalNotifications} from '@capacitor/local-notifications';
import { PluginListenerHandle } from '@capacitor/core';
import { ToastController, AlertController } from '@ionic/angular';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';
import { MedicationReminderService } from 'src/app/core/services/medication-reminder.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.page.html',
  styleUrls: ['./notification.page.scss'],
  standalone: false
})
export class NotificationPage implements OnInit, OnDestroy {
  pendingReminders: any[] = [];
  isLoading = true;
  private refreshInterval: any;

  // FIX: keep a handle to THIS page's own listener so it can be removed on
  // destroy without touching any other listeners registered elsewhere in
  // the app (see ngOnDestroy for why this matters).
  private actionListenerHandle?: PluginListenerHandle;

  constructor(
    private router: Router,
    private medicationService: MedicationService,
    private reminderService: MedicationReminderService,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef,
    private alertCtrl: AlertController
  ) { }

  async ngOnInit() {
    this.actionListenerHandle = await LocalNotifications.addListener('localNotificationActionPerformed', async () => {
      await this.loadNotifications();
      this.cdr.detectChanges();
    });

    await this.loadInitialData();
    
    this.refreshInterval = setInterval(async () => {
      await this.loadNotifications();
      this.cdr.detectChanges();
    }, 30000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);

    // FIX: LocalNotifications.removeAllListeners() is GLOBAL - it was
    // wiping out MedicationReminderService's own listeners too (the ones
    // that handle real OS notification action taps and reschedule the
    // next dose). Leaving this page used to silently break native
    // notification handling for the rest of the session. Only remove the
    // specific listener THIS page registered.
    this.actionListenerHandle?.remove();
  }


  nowTime(): number {
    return new Date().getTime();
  }

  async loadInitialData() {
    this.isLoading = true;
    try {
      await this.loadNotifications();
    } catch (err) {
      console.error('Initial load error:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async loadNotifications(event?: any) {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      const pendingResult = await LocalNotifications.getPending();
      
      this.pendingReminders = pendingResult.notifications
        .map(n => ({
          ...n,
          rawScheduledDate: new Date(n.schedule?.at || new Date())
        }))
        .filter(reminder => {
          const scheduledDateStr = reminder.rawScheduledDate.toISOString().split('T')[0];
          return scheduledDateStr === todayStr;
        })
        .sort((a, b) => a.rawScheduledDate.getTime() - b.rawScheduledDate.getTime());

    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (event) event.target.complete();
    }
  }

  isUpcoming(reminder: any): boolean {
    if (!reminder?.rawScheduledDate) return false;
    const now = new Date().getTime();
    const scheduledTime = reminder.rawScheduledDate.getTime();
    const fifteenMinsBefore = scheduledTime - (15 * 60 * 1000);
    const tenMinsBefore = scheduledTime - (10 * 60 * 1000);
    return now >= fifteenMinsBefore && now < tenMinsBefore;
  }

  isWindowOpen(reminder: any): boolean {
    if (!reminder?.rawScheduledDate) return false;
    const now = new Date().getTime();
    const scheduledTime = reminder.rawScheduledDate.getTime();
    const tenMinsBefore = scheduledTime - (10 * 60 * 1000);
    return now >= tenMinsBefore; 
  }

  /**
   * FIX: previously this only cancelled the ONE notification just acted on
   * and then optimistically edited the local `pendingReminders` array by
   * filtering it in-memory. Nothing ever scheduled the *next* dose's
   * native notification, and nothing re-fetched the real OS pending list
   * afterward - so the "upcoming" item shown right after tapping
   * Taken/Skip wasn't real, and a later refresh would reveal the true
   * (stale) state, sometimes re-showing the just-acted-on reminder with
   * its buttons active again - which allowed a duplicate tap to deduct a
   * second dose.
   *
   * Now: after recording the action, we fetch the updated medication and
   * ask MedicationReminderService to (re)schedule its reminder - which
   * cancels any stale pending notification for this medication and queues
   * the real next dose (or cancels entirely if the course is done/paused).
   * We then reload from the actual OS pending list instead of trusting a
   * locally patched array, so the UI always reflects what's really
   * scheduled.
   */
  async handleAction(reminder: any, action: 'TAKEN' | 'SKIP') {
    const medId = reminder.extra?.medId || reminder.data?.medId;
    if (!medId) {
      this.presentToast('Error: Medication ID not found.');
      return;
    }

    try {
      const actionType: 'taken' | 'skipped' = action === 'TAKEN' ? 'taken' : 'skipped';
      const result = await this.medicationService.recordReminderAction(medId, actionType);

      if (result && (result as any).duplicate) {
        // Guarded against in the service - this dose was already recorded
        // for the current cycle. Just resync the UI, don't toast success.
        await this.loadNotifications();
        this.cdr.detectChanges();
        return;
      }

      // Reschedule (or cancel, if the course is now complete/inactive)
      // this medication's reminder so the real next dose is queued.
      const meds = await this.medicationService.getUserMedications();
      const updatedMed = meds.find(m => m.id === medId);
      if (updatedMed) {
        await this.reminderService.scheduleForMedication(updatedMed);
      } else {
        await this.reminderService.cancelForMedication(medId);
      }

      // Reload from the real OS pending queue instead of trusting a
      // locally filtered array, so the "upcoming" card reflects what's
      // actually scheduled.
      await this.loadNotifications();
      this.cdr.detectChanges();
      
      this.presentToast(action === 'TAKEN' ? 'Dose recorded.' : 'Dose skipped.');
    } catch (err) {
      console.error('Action failed:', err);
      this.presentToast('Failed to update medication.');
    }
  }

  async clearAll() {
  const alert = await this.alertCtrl.create({
    header: 'Clear All Reminders?',
    message: 'This will remove all upcoming notification alerts.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { 
        text: 'Clear All', 
        role: 'destructive',
        handler: async () => {
          const pending = await LocalNotifications.getPending();
          await LocalNotifications.cancel(pending);
          this.pendingReminders = [];
          this.presentToast('All reminders cleared.');
        }
      }
    ]
  });
  await alert.present();
}

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message, duration: 2000, position: 'bottom', color: 'dark'
    });
    await toast.present();
  }

  goHome() {
    this.router.navigate(['/tabs/home']);
  }
}