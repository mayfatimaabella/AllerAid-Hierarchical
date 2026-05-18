import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LocalNotifications, PendingResult } from '@capacitor/local-notifications';
import { ToastController } from '@ionic/angular';

// Core Services
import { MedicationService, Medication } from 'src/app/core/services/medication.service';
import { MedicationReminderService } from 'src/app/core/services/medication-reminder.service';

// Feature Services - Path adjusted based on project structure
import { MedicationManagerService } from 'src/app/features/profile/profile-services/medication-manager.service';

@Component({
  selector: 'app-notification',
  templateUrl: './notification.page.html',
  styleUrls: ['./notification.page.scss'],
  standalone: false
})
export class NotificationPage implements OnInit {
  pendingReminders: any[] = [];
  userMedications: Medication[] = [];
  isLoading = true;

  constructor(
    private router: Router,
    private medicationService: MedicationService,
    private medicationManagerService: MedicationManagerService,
    private reminderService: MedicationReminderService,
    private toastController: ToastController
  ) { }

  async ngOnInit() {
    await this.loadInitialData();
  }

  /**
   * Load both notifications and medication data for synchronization
   * Fixed: Uses await for the Promise-based getUserMedications()
   */
  async loadInitialData() {
    this.isLoading = true;
    try {
      // Fetch medications directly as a Promise
      this.userMedications = await this.medicationService.getUserMedications();
      
      // Load the actual device notifications
      await this.loadNotifications();
    } catch (err) {
      console.error('Error during initial data load:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async loadNotifications(event?: any) {
    try {
      const pending: PendingResult = await LocalNotifications.getPending();
      
      const sorted = pending.notifications.sort((a, b) => {
        const timeA = a.schedule?.at?.getTime() || 0;
        const timeB = b.schedule?.at?.getTime() || 0;
        return timeA - timeB;
      });

      // Highlight the very next dose
      this.pendingReminders = sorted.length > 0 ? [sorted[0]] : [];

    } catch (err) {
      console.error('Error fetching device notifications:', err);
    } finally {
      if (event) event.target.complete();
    }
  }

  /**
   * Handles the live deduction logic using the Manager Service
   */
  async handleAction(reminder: any, action: 'TAKEN' | 'SKIP') {
    const medId = reminder.extra?.medId || reminder.data?.medId;
    
    if (!medId) {
      this.presentToast('Error: Medication ID not found.');
      return;
    }

    try {
      if (action === 'TAKEN') {
        // Use the Manager Service to deduct 1 pill and refresh UI
        await this.medicationManagerService.markDoseAsTaken(
          medId,
          this.userMedications,
          async () => { 
            // Re-fetch everything to ensure "Live" deduction shows
            await this.loadInitialData(); 
          },
          (msg: string) => this.presentToast(msg) // Added string type
        );
      } else {
        await this.medicationService.recordReminderAction(medId, 'skipped');
        this.presentToast('Dose skipped.');
        await this.loadNotifications();
      }
      
      // Clear the local reminder array for instant UI feedback
      this.pendingReminders = this.pendingReminders.filter(r => r.id !== reminder.id);

    } catch (err) {
      console.error('Error processing action:', err);
      this.presentToast('Failed to update medication.');
    }
  }

  async presentToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: 'dark'
    });
    await toast.present();
  }

  async clearAll() {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel(pending);
      }
      this.pendingReminders = [];
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  }

  goHome() {
    this.router.navigate(['/tabs/home']);
  }
}