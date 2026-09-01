import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  IonicModule,
  ToastController
} from '@ionic/angular';

import { AdminEmergencyService } from '../../../core/services/admin/admin-emergency';
import { FirebaseService } from '../../../core/services/firebase.service';


@Component({
  selector: 'app-emergency-logs',

  templateUrl: './emergency-logs.page.html',

  styleUrls: ['./emergency-logs.page.scss'],

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ]
})
export class EmergencyLogsPage {


  /* 
     DATA
      */

  emergencies: any[] = [];

  filteredEmergencies: any[] = [];


  /* 
     FILTERS
      */

  selectedFilter: string = 'all';

  searchTerm: string = '';


  /* 
     STATE
      */

  isLoading = false;


  /* 
     DETAILS MODAL
      */

  selectedEmergency: any = null;


  /* 
     LOCATION CACHE
      */

  private locationCache =
    new Map<string, string>();


  constructor(
    private adminEmergencyService: AdminEmergencyService,

    private firebase: FirebaseService,

    private toastController: ToastController
  ) {}


  /* 
     PAGE LOAD
      */

  async ionViewWillEnter() {

    await this.loadEmergencies();

  }


  /* 
     LOAD EMERGENCIES
      */

  async loadEmergencies() {

    try {

      this.isLoading = true;


      this.emergencies =
        await this.adminEmergencyService
          .getAllEmergencies();


      this.filterEmergencies();


      this.isLoading = false;


      this.resolveLocationsInBackground();


    } catch (error) {

      console.error(
        'Load emergencies error:',
        error
      );


      this.isLoading = false;


      await this.presentToast(
        'Failed to load emergency reports.',
        'danger'
      );

    }

  }


  /* 
     BACKGROUND LOCATION RESOLUTION
      */

  async resolveLocationsInBackground() {

    for (const emergency of this.emergencies) {


      if (emergency.readableLocation) {

        continue;

      }


      emergency.readableLocation =
        await this.getReadableLocation(
          emergency
        );


      /*
       * Re-filter so location searches
       * immediately start working after
       * reverse geocoding completes.
       */

      this.filterEmergencies();

    }

  }


  /* 
     GET STATUS
      */

  getStatus(
    emergency: any
  ): string {

    return emergency?.status || 'active';

  }


  /* 
     FILTER
      */

  applyFilter(
    filter: string
  ) {

    this.selectedFilter = filter;

    this.filterEmergencies();

  }


  /* 
     SEARCH + STATUS FILTER
      */

  filterEmergencies() {

    const search =
      this.searchTerm
        .trim()
        .toLowerCase();


    this.filteredEmergencies =
      this.emergencies.filter(
        emergency => {


          /*
           * STATUS FILTER
           */

          const status =
            this.getStatus(
              emergency
            );


          if (
            this.selectedFilter !== 'all' &&
            status !== this.selectedFilter
          ) {

            return false;

          }


          /*
           * SEARCH
           */

          if (!search) {

            return true;

          }


          const patientName =
            emergency.patientName ||
            '';

          const userName =
            emergency.userName ||
            '';

          const name =
            emergency.name ||
            '';

          const id =
            emergency.id ||
            '';

          const location =
            emergency.readableLocation ||
            emergency.address ||
            '';

          const instruction =
            emergency.instruction ||
            emergency.message ||
            emergency.emergencyMessage ||
            '';

          const contact =
            emergency.contactNumber ||
            emergency.phone ||
            '';


          const searchableText = [

            patientName,

            userName,

            name,

            id,

            location,

            instruction,

            contact

          ]
            .join(' ')
            .toLowerCase();


          return searchableText.includes(
            search
          );

        }
      );

  }


  /* 
     STATUS COUNT
      */

  countByStatus(
    status: string
  ): number {

    return this.emergencies.filter(
      emergency =>
        this.getStatus(emergency) === status
    ).length;

  }


  /* 
     ALLERGIES
      */

  getAllergies(
    emergency: any
  ): string {


    if (
      Array.isArray(
        emergency?.allergies
      ) &&
      emergency.allergies.length > 0
    ) {

      return emergency.allergies.join(
        ', '
      );

    }


    if (emergency?.allergy) {

      return emergency.allergy;

    }


    return 'Not specified';

  }


  /* 
     VIEW DETAILS
      */

  viewDetails(
    emergency: any
  ) {

    this.selectedEmergency =
      emergency;

  }


  /* 
     CLOSE DETAILS
      */

  closeDetails() {

    this.selectedEmergency = null;

  }


  /* 
     UPDATE STATUS
      */

  async updateStatus(
    emergency: any,

    status:
      | 'active'
      | 'responding'
      | 'resolved'
      | 'archived'
  ) {


    const adminUid =
      this.firebase
        .getAuth()
        .currentUser?.uid ??
      'unknown';


    try {


      await this.adminEmergencyService
        .updateEmergencyStatus(
          emergency.id,
          status,
          adminUid
        );


      /*
       * Update current object immediately.
       */

      emergency.status =
        status;


      /*
       * Keep modal synchronized.
       */

      if (
        this.selectedEmergency &&
        this.selectedEmergency.id ===
          emergency.id
      ) {

        this.selectedEmergency.status =
          status;

      }


      /*
       * Refresh filtered results.
       */

      this.filterEmergencies();


      await this.presentToast(
        `Emergency marked as ${status}.`,
        'success'
      );


      /*
       * Reload Firestore data.
       */

      await this.loadEmergencies();


    } catch (error) {

      console.error(
        'Update emergency error:',
        error
      );


      await this.presentToast(
        'Failed to update emergency status.',
        'danger'
      );

    }

  }


  /* 
     TOAST
      */

  async presentToast(
    message: string,

    color: string = 'medium'
  ) {

    const toast =
      await this.toastController.create({

        message,

        duration: 2500,

        position: 'bottom',

        color

      });


    await toast.present();

  }


  /* 
     READABLE LOCATION
      */

  async getReadableLocation(
    emergency: any
  ): Promise<string> {


    /*
     * SAVED ADDRESS
     */

    if (emergency.address) {

      return emergency.address;

    }


    /*
     * LOCATION OBJECT
     */

    if (!emergency.location) {

      return 'Unknown location';

    }


    const latitude =
      emergency.location.latitude ??
      emergency.location.lat;


    const longitude =
      emergency.location.longitude ??
      emergency.location.lng;


    if (
      latitude == null ||
      longitude == null
    ) {

      return 'Unknown location';

    }


    if (
      Number(latitude) === 0 &&
      Number(longitude) === 0
    ) {

      return 'Location unavailable';

    }


    /*
     * CACHE KEY
     */

    const cacheKey =
      `${Number(latitude).toFixed(4)},` +
      `${Number(longitude).toFixed(4)}`;


    if (
      this.locationCache.has(
        cacheKey
      )
    ) {

      return this.locationCache.get(
        cacheKey
      )!;

    }


    try {


      const response =
        await fetch(

          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18`,

          {
            headers: {
              'Accept-Language': 'en'
            }
          }

        );


      if (!response.ok) {

        console.error(
          'Reverse geocoding failed:',
          response.status,
          response.statusText
        );


        return 'Location unavailable';

      }


      const data =
        await response.json();


      if (!data?.address) {

        return 'Location unavailable';

      }


      const address =
        data.address;


      const parts = [

        address.village ||
        address.town ||
        address.city ||
        address.municipality,

        address.county,

        address.state,

        address.country

      ].filter(Boolean);


      const result =
        parts.length > 0

          ? [...new Set(parts)].join(
              ', '
            )

          : data.display_name ||
            'Location unavailable';


      this.locationCache.set(
        cacheKey,
        result
      );


      return result;


    } catch (error) {

      console.error(
        'Reverse geocoding error:',
        error
      );


      return 'Location unavailable';


    } finally {


      /*
       * Nominatim rate limit.
       */

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
