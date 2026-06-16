import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ToastController, AlertController } from '@ionic/angular';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';

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

  constructor(
    private router: Router,
    private medicationService: MedicationService,
    private toastController: ToastController,
    private cdr: ChangeDetectorRef,
    private alertCtrl: AlertController
  ) { }

  async ngOnInit() {
    await LocalNotifications.addListener('localNotificationActionPerformed', async () => {
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
    LocalNotifications.removeAllListeners();
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

  async handleAction(reminder: any, action: 'TAKEN' | 'SKIP') {
    const medId = reminder.extra?.medId || reminder.data?.medId;
    if (!medId) {
      this.presentToast('Error: Medication ID not found.');
      return;
    }

    try {
      const actionType: 'taken' | 'skipped' = action === 'TAKEN' ? 'taken' : 'skipped';
      await this.medicationService.recordReminderAction(medId, actionType);
      
      await LocalNotifications.cancel({ notifications: [{ id: reminder.id }] });
      this.pendingReminders = this.pendingReminders.filter(r => r.id !== reminder.id);
      
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