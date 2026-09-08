import {
  Component,
  OnInit,
  OnDestroy
} from '@angular/core';

import { Router } from '@angular/router';

import { EmergencyService }
  from '../../../../core/services/emergency.service';

import { BuddyService }
  from '../../../../core/services/buddy.service';

import { AuthService }
  from '../../../../core/services/auth.service';

import { Subscription }
  from 'rxjs';

import { CommonModule }
  from '@angular/common';

import { FormsModule }
  from '@angular/forms';

import { IonicModule }
  from '@ionic/angular';

import { EmergencyAlert }
  from '../../../../core/models/emergency-alert.model';

import { EmergencyLocation }
  from 'src/app/core/models/emergency-location.model';

import { Timestamp }
  from '@angular/fire/firestore';


@Component({
  selector: 'app-emergencies',

  templateUrl:
    './emergency-center.page.html',

  styleUrls:
    ['./emergency-center.page.scss'],

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ]
})
export class EmergenciesPage
  implements OnInit, OnDestroy {


  
  // EMERGENCY DATA
  

  activeEmergencies: EmergencyAlert[] = [];

  historyEmergencies: EmergencyAlert[] = [];


  
  // CURRENT TAB
  

  selectedTab: string = 'incoming';


  
  // CURRENT USER
  

  private currentUserId: string | null = null;


  
  // SUBSCRIPTION
  

  private emergencySubscription:
    Subscription | null = null;


  
  // LOCATION ADDRESS CACHE
  

  private locationAddressCache =
    new Map<string, string>();


  
  // CONSTRUCTOR
  

  constructor(
    private router: Router,

    private emergencyService:
      EmergencyService,

    private buddyService:
      BuddyService,

    private authService:
      AuthService
  ) {}


  
  // INIT
  

  async ngOnInit(): Promise<void> {

    await this.setupRealTimeEmergencyListener();

  }


  
  // DESTROY
  

  ngOnDestroy(): void {

    this.emergencySubscription?.unsubscribe();

    this.emergencySubscription = null;

  }


  
  // REAL-TIME EMERGENCY LISTENER
  

  private async setupRealTimeEmergencyListener():
    Promise<void> {


    // Prevent duplicate subscriptions

    this.emergencySubscription?.unsubscribe();

    this.emergencySubscription = null;


    try {

      // Get authenticated user

      const user =
        await this.authService.waitForAuthInit();


      if (!user) {

        console.warn(
          'Emergency Center: no authenticated user.'
        );

        return;

      }


      // Save user ID

      this.currentUserId =
        user.uid;


      // Start buddy emergency listener

      this.buddyService
        .listenForEmergencyAlerts(
          user.uid
        );


      // Subscribe to real-time alerts

      this.emergencySubscription =
        this.buddyService
          .activeEmergencyAlerts$
          .subscribe(
            async emergencies => {

              try {

                // =================================================
                // GET COMPLETED BUDDY EMERGENCIES
                // =================================================

                const resolvedEmergencies =
                  await this.emergencyService
                    .getBuddyEmergenciesByStatus(
                      user.uid,
                      [
                        'resolved',
                        'cancelled'
                      ]
                    );


                // =================================================
                // GET USER-INITIATED EMERGENCIES
                // =================================================

                const userInitiated =
                  await this.emergencyService
                    .getUserEmergenciesByStatus(
                      user.uid,
                      [
                        'active',
                        'responding',
                        'resolved',
                        'cancelled'
                      ]
                    );


                // =================================================
                // SEPARATE ACTIVE EMERGENCIES
                // =================================================

                const active =
                  emergencies.filter(
                    emergency => {

                      if (!emergency.id) {
                        return false;
                      }

                      const status =
                        this.getStatusDisplay(
                          emergency
                        );

                      return (
                        status === 'active' ||
                        status === 'responding'
                      );

                    }
                  );


                // =================================================
                // BUILD HISTORY
                // =================================================

                const historyMap =
                  new Map<
                    string,
                    EmergencyAlert
                  >();


                [
                  ...resolvedEmergencies,
                  ...userInitiated
                ].forEach(
                  emergency => {

                    if (!emergency.id) {
                      return;
                    }


                    const status =
                      this.getStatusDisplay(
                        emergency
                      );


                    // Only completed emergencies belong
                    // in History.

                    if (
                      status === 'resolved' ||
                      status === 'cancelled'
                    ) {

                      historyMap.set(
                        emergency.id,
                        emergency
                      );

                    }

                  }
                );


                // Also include completed emergencies
                // that may already exist in the listener.

                emergencies.forEach(
                  emergency => {

                    if (!emergency.id) {
                      return;
                    }


                    const status =
                      this.getStatusDisplay(
                        emergency
                      );


                    if (
                      status === 'resolved' ||
                      status === 'cancelled'
                    ) {

                      historyMap.set(
                        emergency.id,
                        emergency
                      );

                    }

                  }
                );


                // =================================================
                // UPDATE PAGE DATA
                // =================================================

                this.activeEmergencies = [
                  ...active
                ];


                this.historyEmergencies =
                  Array.from(
                    historyMap.values()
                  );


                // =================================================
                // POPULATE ADDRESSES
                // =================================================

                await this.populateAddresses(
                  [
                    ...this.activeEmergencies,
                    ...this.historyEmergencies
                  ]
                );


              } catch (error) {

                console.error(
                  'Error processing emergencies:',
                  error
                );

              }

            }
          );


    } catch (error) {

      console.error(
        'Error setting up emergency listener:',
        error
      );

    }

  }


  
  // DISMISS
  

  async dismissEmergency(
    emergency: EmergencyAlert
  ): Promise<void> {

    try {

      const user =
        await this.authService
          .waitForAuthInit();


      if (!user) {

        console.warn(
          'Cannot dismiss: no authenticated user.'
        );

        return;

      }


      if (!emergency.id) {

        console.warn(
          'Cannot dismiss emergency without an ID.'
        );

        return;

      }


      // Hide only for this responder.

      this.buddyService
        .dismissEmergencyForUser(
          user.uid,
          emergency.id
        );


      // Remove from Incoming.

      this.activeEmergencies =
        this.activeEmergencies.filter(
          item =>
            item.id !== emergency.id
        );


      console.log(
        'Emergency dismissed from responder view:',
        emergency.id
      );


    } catch (error) {

      console.error(
        'Error dismissing emergency:',
        error
      );

    }

  }


  
  // TAB CHANGE
  

  onTabChange(): void {

    console.log(
      'Emergency Center tab:',
      this.selectedTab
    );

  }


  
  // STATUS DISPLAY
  

  getStatusDisplay(
    emergency: EmergencyAlert
  ): string {

    return (
      emergency.status
        ?.toString()
        .trim()
        .toLowerCase() ||
      'unknown'
    );

  }


  
  // STATUS COLOR
  

  getStatusColor(
    status: string
  ): string {

    switch (
      status
        ?.toString()
        .trim()
        .toLowerCase()
    ) {

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


  
  // REFRESH
  

  async refreshEmergencies(): Promise<void> {

    await this.setupRealTimeEmergencyListener();

  }


  
  // RESPOND TO EMERGENCY
  

  async respondToEmergency(
    emergency: EmergencyAlert
  ): Promise<void> {

    try {

      const user =
        await this.authService
          .waitForAuthInit();


      if (!user) {

        console.warn(
          'Cannot respond: no authenticated user.'
        );

        return;

      }


      if (!emergency.id) {

        console.warn(
          'Cannot respond without emergency ID.'
        );

        return;

      }


      // Update actual emergency status.

      await this.emergencyService
        .respondToEmergency(
          emergency.id,
          user.uid,
          user.displayName ||
          'Buddy Response'
        );


      // Open responder dashboard.

      await this.viewOnMap(
        emergency
      );


    } catch (error) {

      console.error(
        'Error responding to emergency:',
        error
      );

    }

  }


  
  // VIEW ON MAP / RESPONDER DASHBOARD
  

  async viewOnMap(
    emergency: EmergencyAlert
  ): Promise<void> {

    await this.router.navigate(
      [
        '/tabs/responder-dashboard'
      ],
      {
        state: {

          emergencyData: {

            emergencyId:
              emergency.id,

            alert:
              emergency,

            userName:
              emergency.userName

          }

        }

      }
    );

  }


  
  // CALL PATIENT
  

  callPatient(
    emergency: EmergencyAlert
  ): void {

    console.log(
      'Calling patient:',
      emergency.id
    );

  }


  
  // VIEW HISTORY DETAILS
  

  async viewEmergencyDetails(
    emergency: EmergencyAlert
  ): Promise<void> {

    if (!emergency?.id) {

      console.error(
        'Cannot open emergency: missing ID'
      );

      return;

    }


    await this.router.navigate(
      [
        '/emergency-history-details',
        emergency.id
      ]
    );

  }


  
  // POPULATE ADDRESSES
  

  private async populateAddresses(
    emergencies: EmergencyAlert[]
  ): Promise<void> {

    const toGeocode: {
      emergency: EmergencyAlert;
      key: string;
    }[] = [];


    for (
      const emergency of emergencies
    ) {

      if (
        emergency.displayAddress
      ) {

        continue;

      }


      if (
        !emergency.location
      ) {

        continue;

      }


      const {
        latitude,
        longitude
      } = emergency.location;


      const key =
        `${latitude},${longitude}`;


      const cached =
        this.locationAddressCache.get(
          key
        );


      if (cached) {

        emergency.displayAddress =
          cached;

        continue;

      }


      toGeocode.push({
        emergency,
        key
      });

    }


    // Sequential reverse geocoding

    for (
      const {
        emergency,
        key
      } of toGeocode
    ) {

      try {

        const response =
          await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${emergency.location!.latitude}&lon=${emergency.location!.longitude}`
          );


        if (!response.ok) {

          throw new Error(
            `HTTP ${response.status}`
          );

        }


        const data =
          await response.json();


        const address =
          data?.display_name ??
          this.getLocationDisplay(
            emergency.location
          );


        emergency.displayAddress =
          address;


        this.locationAddressCache.set(
          key,
          address
        );


      } catch (error) {

        console.error(
          'Reverse geocoding failed:',
          error
        );


        emergency.displayAddress =
          this.getLocationDisplay(
            emergency.location
          );

      }


      // Respect Nominatim request rate

      if (
        toGeocode.length > 1
      ) {

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              1100
            )
        );

      }

    }

  }


  
  // LOCATION DISPLAY
  

  getLocationDisplay(
    location:
      EmergencyLocation |
      null |
      undefined
  ): string {

    if (!location) {

      return 'Location unavailable';

    }


    return (
      `${location.latitude.toFixed(4)}, ` +
      `${location.longitude.toFixed(4)}`
    );

  }


  
  // TIME AGO
  

  getTimeAgo(
    timestamp:
      Timestamp |
      Date |
      string |
      null |
      undefined
  ): string {

    if (!timestamp) {

      return 'Unknown time';

    }


    const alertTime =
      this.toDate(timestamp);


    if (!alertTime) {

      return 'Unknown time';

    }


    const now =
      new Date();


    const diffMs =
      now.getTime() -
      alertTime.getTime();


    const diffMins =
      Math.floor(
        diffMs / 60000
      );


    if (diffMins < 1) {

      return 'Just now';

    }


    if (diffMins < 60) {

      return `${diffMins}m ago`;

    }


    const diffHours =
      Math.floor(
        diffMins / 60
      );


    if (diffHours < 24) {

      return `${diffHours}h ago`;

    }


    return (
      `${Math.floor(
        diffHours / 24
      )}d ago`
    );

  }


  
  // TO DATE
  

toDate(timestamp: any): Date | null {

  if (!timestamp) {
    return null;
  }

  // JavaScript Date
  if (timestamp instanceof Date) {
    return isNaN(timestamp.getTime())
      ? null
      : timestamp;
  }

  // Firestore Timestamp
  if (
    typeof timestamp.toDate === 'function'
  ) {
    const date = timestamp.toDate();

    return date instanceof Date &&
           !isNaN(date.getTime())
      ? date
      : null;
  }

  // Firestore Timestamp-like object
  if (
    typeof timestamp.seconds === 'number'
  ) {
    return new Date(
      timestamp.seconds * 1000
    );
  }

  // String / number
  const date = new Date(timestamp);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}


formatEmergencyDate(timestamp: any): string {
  const date = this.toDate(timestamp);

  if (!date) {
    return 'Unknown date';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}



}
