import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Timestamp } from 'firebase/firestore';

import { EmergencyService } from '../../../../core/services/emergency.service';
import { AuthService } from '../../../../core/services/auth.service';

import { EmergencyAlert } from '../../../../core/models/emergency-alert.model';
import { EmergencyLocation } from '../../../../core/models/emergency-location.model';

import { IonicModule,AlertController  } from '@ionic/angular';



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
    private alertController: AlertController
  ) {}

  
  // LIFECYCLE
  

  async ngOnInit(): Promise<void> {

    this.emergencyId =
      this.route.snapshot.paramMap.get('id') || '';

    if (!this.emergencyId) {

      this.errorMessage =
        'Emergency record not found.';

      this.loading = false;

      return;
    }

    await this.loadEmergency();
  }

  
  // LOAD EMERGENCY
  

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
          emergency =>
            emergency.id === this.emergencyId
        );

      if (userEmergency) {

        console.log(
          'Loaded user emergency:',
          userEmergency
        );

        console.log(
          'Emergency timestamp:',
          userEmergency.timestamp
        );

        console.log(
          'Timestamp type:',
          typeof userEmergency.timestamp
        );

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
          emergency =>
            emergency.id === this.emergencyId
        );

      if (buddyEmergency) {

        console.log(
          'Loaded buddy emergency:',
          buddyEmergency
        );

        console.log(
          'Emergency timestamp:',
          buddyEmergency.timestamp
        );

        console.log(
          'Timestamp type:',
          typeof buddyEmergency.timestamp
        );

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

  
  // REVERSE GEOCODING
  

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

      const data =
        await response.json();

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

  
  // STATUS
  

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

  
  // LOCATION
  

  /**
   * Get readable location.
   */
  getLocationDisplay(
    location:
      | EmergencyLocation
      | null
      | undefined
  ): string {

    if (!location) {
      return 'Location unavailable';
    }

    return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
  }

  
  // DATE / TIME
  

  /**
   * Convert Firestore Timestamp, Date, string,
   * number, or serialized Firestore Timestamp
   * into a JavaScript Date.
   *
   * This is intentionally more robust than using
   * `timestamp instanceof Timestamp`, because data
   * can sometimes arrive as a serialized object.
   */
  toDate(
    timestamp:
      | Timestamp
      | Date
      | string
      | number
      | {
          seconds?: number;
          nanoseconds?: number;
          _seconds?: number;
          _nanoseconds?: number;
        }
      | null
      | undefined
  ): Date | null {

    // Nothing supplied
    if (timestamp == null) {
      return null;
    }

    // Already a JavaScript Date
    if (timestamp instanceof Date) {

      return isNaN(timestamp.getTime())
        ? null
        : timestamp;
    }

    /*
     * Firebase Timestamp.
     *
     * We check for toDate() rather than relying
     * exclusively on instanceof Timestamp.
     */
    if (
      typeof timestamp === 'object' &&
      'toDate' in timestamp &&
      typeof (timestamp as any).toDate === 'function'
    ) {

      try {

        const date =
          (timestamp as any).toDate();

        if (
          date instanceof Date &&
          !isNaN(date.getTime())
        ) {
          return date;
        }

      } catch (error) {

        console.warn(
          'Could not convert Firestore Timestamp:',
          error
        );
      }
    }

    /*
     * Serialized Firestore Timestamp.
     *
     * Example:
     *
     * {
     *   seconds: 1757040000,
     *   nanoseconds: 123000000
     * }
     *
     * Some serialized objects use _seconds.
     */
    if (typeof timestamp === 'object') {

      const seconds =
        (timestamp as any).seconds ??
        (timestamp as any)._seconds;

      const nanoseconds =
        (timestamp as any).nanoseconds ??
        (timestamp as any)._nanoseconds ??
        0;

      if (
        typeof seconds === 'number' &&
        isFinite(seconds)
      ) {

        const milliseconds =
          seconds * 1000 +
          Math.floor(
            nanoseconds / 1_000_000
          );

        const date =
          new Date(milliseconds);

        return isNaN(date.getTime())
          ? null
          : date;
      }
    }

    /*
     * Unix timestamp in milliseconds.
     */
    if (typeof timestamp === 'number') {

      const date =
        new Date(timestamp);

      return isNaN(date.getTime())
        ? null
        : date;
    }

    /*
     * ISO/date string.
     */
    if (typeof timestamp === 'string') {

      const date =
        new Date(timestamp);

      return isNaN(date.getTime())
        ? null
        : date;
    }

    return null;
  }

  /**
   * Get the emergency date.
   */
  getEmergencyDate(): Date | null {

    if (!this.emergency) {
      return null;
    }

    return this.toDate(
      this.emergency.timestamp as any
    );
  }

  /**
   * Get a relative time such as:
   *
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
      | number
      | {
          seconds?: number;
          nanoseconds?: number;
          _seconds?: number;
          _nanoseconds?: number;
        }
      | null
      | undefined
  ): string {

    const date =
      this.toDate(timestamp);

    if (!date) {
      return 'Unknown time';
    }

    const now =
      new Date();

    const difference =
      now.getTime() -
      date.getTime();

    const minutes =
      Math.floor(
        difference / 60000
      );

    if (minutes < 1) {
      return 'Just now';
    }

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    return `${days}d ago`;
  }

  
  // RECORD INFORMATION
  

  /**
   * Display information about the history record.
   */
  async showRecordInfo(): Promise<void> {

    const alert =
      await this.alertController.create({

        header:
          'Emergency Record',

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

  
  // RETRY
  

  /**
   * Retry loading the emergency.
   */
  async retry(): Promise<void> {

    await this.loadEmergency();
  }

  
  // NAVIGATION
  

  /**
   * Navigate back to Emergency Center. 
   */
  goBack(): void {

    this.router.navigate([
      '/alerts'
    ]);
  }

}
