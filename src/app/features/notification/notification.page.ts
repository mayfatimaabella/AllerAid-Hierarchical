import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LocalNotifications, PendingResult } from '@capacitor/local-notifications';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.page.html',
  styleUrls: ['./notification.page.scss'],
  standalone: false,
})
export class NotificationPage implements OnInit {
  pendingReminders: any[] = [];
  isLoading = true;

  constructor(private router: Router) { }

  async ngOnInit() {
    await this.loadNotifications();
  }

  /*Directly fetches pending notifications from the device.If empty, the UI will handle the empty state via *ngIf.*/
  async loadNotifications(event?: any) {
    if (!event) this.isLoading = true;
    
    try {
      const pending: PendingResult = await LocalNotifications.getPending();
      this.pendingReminders = [...pending.notifications];
    } catch (err) {
      console.error('Error fetching device notifications:', err);
    } finally {
      this.isLoading = false;
      if (event) {
        event.target.complete();
      }
    }
  }

  /* Cancels all pending notifications on the device and clears the view.*/
  async clearAll() {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
      this.pendingReminders = [];
    } catch (err) {
      console.error('Error clearing device notifications:', err);
    }
  }

  goHome() {
    this.router.navigate(['/tabs/home']);
  }
}