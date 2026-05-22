import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ToastController } from '@ionic/angular';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.page.html',
  styleUrls: ['./notification.page.scss'],
  standalone: false
})
export class NotificationPage implements OnInit, OnDestroy {
  pendingReminders: any[] = [];
  userMedications: Medication[] = [];
  isLoading = true;
  private refreshInterval: any;

  constructor(
    private router: Router,
    private medicationService: MedicationService,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef 
  ) { }

  async ngOnInit() {
    // Listener to handle notification interaction immediately
    await LocalNotifications.addListener('localNotificationActionPerformed', async () => {
      await this.loadNotifications();
      this.cdr.detectChanges();
    });

    await this.loadInitialData();
    
    // Refresh interval for time-sensitive UI updates
    this.refreshInterval = setInterval(async () => {
      await this.loadNotifications();
      this.cdr.detectChanges();
    }, 30000);
  }

  ngOnDestroy() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    LocalNotifications.removeAllListeners();
  }

  async loadInitialData() {
    this.isLoading = true;
    try {
      this.userMedications = await this.medicationService.getUserMedications();
      await this.loadNotifications();
    } catch (err) {
      console.error('Initial load error:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async loadNotifications(event?: any) {
    try {
      const nowMs = new Date().getTime();
      const pendingResult = await LocalNotifications.getPending();
      
      this.pendingReminders = pendingResult.notifications.map(n => ({
        ...n,
        rawScheduledDate: new Date(n.schedule?.at || new Date())
      })).filter(reminder => {
        const scheduledMs = reminder.rawScheduledDate.getTime();
        const windowEnd = scheduledMs + (60 * 60 * 1000); 
        // 5-second buffer (nowMs >= scheduledMs - 5000) accounts for clock drift
        return nowMs >= (scheduledMs - 5000) && nowMs < windowEnd;
      }).sort((a, b) => a.rawScheduledDate.getTime() - b.rawScheduledDate.getTime());
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      if (event) event.target.complete();
    }
  }

  isWindowOpen(reminder: any): boolean {
    if (!reminder?.rawScheduledDate) return false;
    const now = new Date().getTime();
    const scheduledTime = new Date(reminder.rawScheduledDate).getTime();
    const windowEnd = scheduledTime + (60 * 60 * 1000);
    return now >= (scheduledTime - 5000) && now < windowEnd;
  }

  async handleAction(reminder: any, action: 'TAKEN' | 'SKIP') {
    const medId = reminder.extra?.medId || reminder.data?.medId;
    if (!medId) {
      this.presentToast('Error: Medication ID not found.');
      return;
    }

    try {
      // Correct type casting to match your service's expected union type
      const actionType: 'taken' | 'skipped' = action === 'TAKEN' ? 'taken' : 'skipped';
      
      await this.medicationService.recordReminderAction(medId, actionType);
      
      // Aggressive cancellation to prevent "Ghost" notifications
      await LocalNotifications.cancel({ notifications: [{ id: reminder.id }] });
      
      // Sync UI state
      this.pendingReminders = this.pendingReminders.filter(r => r.id !== reminder.id);
      this.presentToast(action === 'TAKEN' ? 'Dose recorded.' : 'Dose skipped.');
    } catch (err) {
      console.error('Action failed:', err);
      this.presentToast('Failed to update medication.');
    }
  }

  async clearAll() {
    const pending = await LocalNotifications.getPending();
    await LocalNotifications.cancel(pending);
    this.pendingReminders = [];
    this.presentToast('All reminders cleared.');
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message, duration: 2000, position: 'bottom', color: 'dark'
    });
    await toast.present();
  }

  goHome() { this.router.navigate(['/tabs/home']); }
}