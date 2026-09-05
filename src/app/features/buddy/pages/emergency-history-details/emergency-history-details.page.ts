import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Timestamp } from '@angular/fire/firestore';

import { EmergencyService } from '../../../../core/services/emergency.service';
import { AuthService } from '../../../../core/services/auth.service';

import { EmergencyAlert } from '../../../../core/models/emergency-alert.model';
import { EmergencyLocation } from '../../../../core/models/emergency-location.model';

@Component({
  selector: 'app-emergency-history-details',
  templateUrl: './emergency-history-details.page.html',
  styleUrls: ['./emergency-history-details.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ]
})
export class EmergencyHistoryDetailsPage implements OnInit {

  emergency: EmergencyAlert | null = null;

  emergencyId = '';

  loading = true;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private emergencyService: EmergencyService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {
    this.emergencyId =
      this.route.snapshot.paramMap.get('id') || '';

    if (!this.emergencyId) {
      this.errorMessage = 'Emergency record not found.';
      this.loading = false;
      return;
    }

    await this.loadEmergency();
  }

  /**
   * Load the selected emergency.
   */
  private async loadEmergency(): Promise<void> {
    try {
      this.loading = true;
      this.errorMessage = '';

      const user =
        await this.authService.waitForAuthInit();

      if (!user) {
        this.errorMessage =
          'You must be logged in to view this emergency.';
        return;
      }

      /*
       * First check emergencies initiated by the
       * currently authenticated user.
       */
      const userEmergencies =
        await this.emergencyService.getUserEmergenciesByStatus(
          user.uid,
          [
            'active',
            'responding',
            'resolved',
            'cancelled'
          ]
        );

      const userEmergency =
        userEmergencies.find(
          emergency => emergency.id === this.emergencyId
        );

      if (userEmergency) {
        this.emergency = userEmergency;

        await this.populateAddress();

        return;
      }

      /*
       * If it wasn't initiated by the current user,
       * check emergencies where the current user is
       * a buddy/responder.
       */
      const buddyEmergencies =
        await this.emergencyService.getBuddyEmergenciesByStatus(
          user.uid,
          [
            'active',
            'responding',
            'resolved',
            'cancelled'
          ]
        );

      const buddyEmergency =
        buddyEmergencies.find(
          emergency => emergency.id === this.emergencyId
        );

      if (buddyEmergency) {
        this.emergency = buddyEmergency;

        await this.populateAddress();

        return;
      }

      this.errorMessage =
        'This emergency record could not be found.';

    } catch (error) {
      console.error(
        'Error loading emergency details:',
        error
      );

      this.errorMessage =
        'Unable to load emergency details. Please try again.';

    } finally {
      this.loading = false;
    }
  }

  /**
   * Reverse geocode the emergency location.
   */
  private async populateAddress(): Promise<void> {

    if (!this.emergency?.location) {
      return;
    }

    if (this.emergency.displayAddress) {
      return;
    }

    const {
      latitude,
      longitude
    } = this.emergency.location;

    try {

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
      );

      if (!response.ok) {
        throw new Error(
          `Reverse geocoding failed: ${response.status}`
        );
      }

      const data = await response.json();

      this.emergency.displayAddress =
        data?.display_name ||
        this.getLocationDisplay(
          this.emergency.location
        );

    } catch (error) {

      console.error(
        'Error getting emergency address:',
        error
      );

      this.emergency.displayAddress =
        this.getLocationDisplay(
          this.emergency.location
        );
    }
  }

  /**
   * Return a readable status.
   */
  getStatusDisplay(): string {

    if (!this.emergency) {
      return 'Unknown';
    }

    switch (this.emergency.status) {

      case 'resolved':
        return 'Completed';

      case 'cancelled':
        return 'Cancelled';

      case 'responding':
        return 'Responding';

      case 'active':
        return 'Active';

      default:
        return this.emergency.status || 'Unknown';
    }
  }

  /**
   * Return Ionic color for status badge.
   */
  getStatusColor(): string {

    if (!this.emergency) {
      return 'medium';
    }

    switch (this.emergency.status) {

      case 'active':
        return 'danger';

      case 'responding':
        return 'warning';

      case 'resolved':
        return 'success';

      case 'cancelled':
        return 'medium';

      default:
        return 'medium';
    }
  }

  /**
   * Get readable location.
   */
  getLocationDisplay(
    location: EmergencyLocation | null | undefined
  ): string {

    if (!location) {
      return 'Location unavailable';
    }

    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  /**
   * Convert Firestore Timestamp, Date, or string
   * into a JavaScript Date.
   */
  toDate(
    timestamp:
      | Timestamp
      | Date
      | string
      | null
      | undefined
  ): Date | null {

    if (!timestamp) {
      return null;
    }

    if (timestamp instanceof Date) {
      return timestamp;
    }

    if (timestamp instanceof Timestamp) {
      return timestamp.toDate();
    }

    const date = new Date(timestamp);

    if (isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  /**
   * Get a relative time such as:
   * Just now
   * 5m ago
   * 2h ago
   * 3d ago
   */
  getTimeAgo(
    timestamp:
      | Timestamp
      | Date
      | string
      | null
      | undefined
  ): string {

    const date = this.toDate(timestamp);

    if (!date) {
      return 'Unknown time';
    }

    const now = new Date();

    const difference =
      now.getTime() - date.getTime();

    const minutes =
      Math.floor(difference / 60000);

    if (minutes < 1) {
      return 'Just now';
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days =
      Math.floor(hours / 24);

    return `${days}d ago`;
  }

  /**
   * Open the emergency location.
   */
  async viewOnMap(): Promise<void> {

    if (!this.emergency) {
      return;
    }

    if (!this.emergency.location) {
      await this.showToast(
        'Emergency location is unavailable.'
      );

      return;
    }

    try {

      await this.router.navigate(
        ['/responder-map'],
        {
          state: {
            emergencyData: {
              emergencyId:
                this.emergency.id,

              alert:
                this.emergency,

              userName:
                this.emergency.userName
            }
          }
        }
      );

    } catch (error) {

      console.error(
        'Error opening emergency map:',
        error
      );

      await this.showToast(
        'Unable to open the map.'
      );
    }
  }

  /**
   * Call patient.
   *
   * This currently only provides a placeholder because
   * your EmergencyAlert model shown earlier does not
   * contain a phone number.
   */
  async callPatient(): Promise<void> {

    if (!this.emergency) {
      return;
    }

    console.log(
      'Calling patient:',
      this.emergency.userName,
      this.emergency.id
    );

    await this.showToast(
      `Calling ${this.emergency.userName || 'patient'}...`
    );
  }

  /**
   * Display information about the history record.
   */
  async showRecordInfo(): Promise<void> {

    const alert =
      await this.alertController.create({
        header: 'Emergency Record',
        message:
          'This page contains the details of a previous emergency alert.',
        buttons: [
          {
            text: 'OK',
            role: 'cancel'
          }
        ]
      });

    await alert.present();
  }

  /**
   * Retry loading the emergency.
   */
  async retry(): Promise<void> {
    await this.loadEmergency();
  }

  /**
   * Navigate back to Emergency Center.
   */
  goBack(): void {

    this.router.navigate([
      '/alerts'
    ]);
  }

  /**
   * Display a toast.
   */
  private async showToast(
    message: string
  ): Promise<void> {

    const toast =
      await this.toastController.create({
        message,
        duration: 2000,
        position: 'bottom'
      });

    await toast.present();
  }
}
