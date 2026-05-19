import { Component, OnInit, OnDestroy } from '@angular/core'; // Added OnDestroy
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
export class NotificationPage implements OnInit, OnDestroy { // Implemented OnDestroy
  pendingReminders: any[] = [];
  userMedications: Medication[] = [];
  isLoading = true;
  private refreshInterval: any; // Track the timer handler instance

  constructor(
    private router: Router,
    private medicationService: MedicationService,
    private medicationManagerService: MedicationManagerService,
    private reminderService: MedicationReminderService,
    private toastController: ToastController
  ) { }

  async ngOnInit() {
    await this.loadInitialData();

    // Check the device clock every 30 seconds to automatically unlock buttons live
    this.refreshInterval = setInterval(async () => {
      await this.loadNotifications();
    }, 30 * 1000);
  }

  // Clear memory and clean up the timer interval context upon view destruction
  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
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

      // Normalize notification schedules to standard ISO strings for structural UI binding
      const normalizedReminders = sorted.map(reminder => {
        let scheduledDateString = '';
        if (reminder.schedule?.at) {
          scheduledDateString = reminder.schedule.at.toISOString();
        } else {
          scheduledDateString = new Date().toISOString(); // Fallback structure safety
        }

        return {
          ...reminder,
          scheduledDateTime: scheduledDateString
        };
      });

      // Highlight the very next dose
      this.pendingReminders = normalizedReminders.length > 0 ? [normalizedReminders[0]] : [];

    } catch (err) {
      console.error('Error fetching device notifications:', err);
    } finally {
      if (event) event.target.complete();
    }
  }

  /**
   * Evaluates if the action buttons should unlock.
   * Returns true ONLY if the current time matches or falls within 1 hour after the scheduled dose time.
   */
  isWindowOpen(scheduledTimeString: string): boolean {
    if (!scheduledTimeString) return false;

    const now = new Date();
    const scheduledTime = new Date(scheduledTimeString);
    
    // Create an absolute 1-hour expiration timestamp limit boundary grace period
    const windowEnd = new Date(scheduledTime.getTime() + (60 * 60 * 1000));

    // True if now has reached the start mark, but hasn't overrun the grace period limit
    return now >= scheduledTime && now < windowEnd;
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