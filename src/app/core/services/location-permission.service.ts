import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationPermissionResult {
  granted: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LocationPermissionService {
  constructor(
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  /**
   * Main permission request method.
   * Mobile app = Capacitor native permission.
   * ionic serve = browser permission fallback.
   */
  async requestLocationPermissions(): Promise<LocationPermissionResult> {
    if (Capacitor.isNativePlatform()) {
      return this.requestNativePermissions();
    }

    return this.requestBrowserPermissions();
  }

  /**
   * Check if location permission is already granted.
   * This is used when the onboarding page loads.
   */
  async isLocationAvailable(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      return this.isNativeLocationGranted();
    }

    return this.isBrowserLocationGranted();
  }

  /**
   * Native Android/iOS permission request.
   */
  private async requestNativePermissions(): Promise<LocationPermissionResult> {
    try {
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        return {
          granted: false,
          message: 'Location services are not available on this device.',
        };
      }

      const permissions = await Geolocation.requestPermissions();

      const preciseGranted = permissions.location === 'granted';
      const coarseGranted = permissions.coarseLocation === 'granted';

      if (preciseGranted || coarseGranted) {
        return {
          granted: true,
          message: preciseGranted
            ? 'Location permission granted.'
            : 'Approximate location permission granted.',
        };
      }

      if (permissions.location === 'denied') {
        await this.showNativePermissionDeniedAlert();

        return {
          granted: false,
          message: 'Location permission denied. Please enable it in device settings.',
        };
      }

      return {
        granted: false,
        message: 'Location permission was not granted.',
      };
    } catch (error) {
      console.error('Error requesting native location permission:', error);

      return {
        granted: false,
        message: 'Error requesting location permission.',
      };
    }
  }

  /**
   * Native Android/iOS permission check.
   */
  private async isNativeLocationGranted(): Promise<boolean> {
    try {
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        return false;
      }

      const permissions = await Geolocation.checkPermissions();

      return (
        permissions.location === 'granted' ||
        permissions.coarseLocation === 'granted'
      );
    } catch (error) {
      console.error('Error checking native location permission:', error);
      return false;
    }
  }

  /**
   * Browser permission request.
   * Used only for ionic serve/testing.
   */
  private async requestBrowserPermissions(): Promise<LocationPermissionResult> {
    if (!navigator.geolocation) {
      return {
        granted: false,
        message: 'Location services are not supported by this browser.',
      };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          resolve({
            granted: true,
            message: 'Location permission granted.',
          });
        },
        async (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            await this.showBrowserPermissionDeniedAlert();

            resolve({
              granted: false,
              message: 'Location access denied. Please allow location access in your browser.',
            });
            return;
          }

          if (error.code === error.POSITION_UNAVAILABLE) {
            resolve({
              granted: false,
              message: 'Location information is unavailable. Please check your location settings.',
            });
            return;
          }

          if (error.code === error.TIMEOUT) {
            resolve({
              granted: false,
              message: 'Location request timed out. Please try again.',
            });
            return;
          }

          resolve({
            granted: false,
            message: 'Unable to retrieve location. Please check your location settings.',
          });
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        }
      );
    });
  }

  /**
   * Browser permission check.
   * Used only for ionic serve/testing.
   *
   * Important:
   * Do not return true just because navigator.geolocation exists.
   * That only means the browser supports location, not that permission is granted.
   */
  private async isBrowserLocationGranted(): Promise<boolean> {
    if (!navigator.geolocation) {
      return false;
    }

    if ('permissions' in navigator) {
      try {
        const permissionStatus = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });

        return permissionStatus.state === 'granted';
      } catch (error) {
        console.error('Error checking browser location permission:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Alert shown when native permission is denied.
   */
  private async showNativePermissionDeniedAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Location Permission Required',
      message:
        'AllerAid needs location access so your buddies can find you during an emergency. Please enable location permission in your device settings.',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'How to Enable',
          handler: () => {
            this.showNativeSettingsInstructions();
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Alert shown when browser permission is denied.
   */
  private async showBrowserPermissionDeniedAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Location Access Required',
      message:
        'AllerAid needs location access for emergency assistance. Please allow location access in your browser settings.',
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
        },
      ],
    });

    await alert.present();
  }

  /**
   * Toast for location-required situations.
   */
  async showLocationRequiredToast(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Location access is needed during emergencies.',
      duration: 4000,
      position: 'bottom',
      color: 'warning',
      buttons: [
        {
          text: 'Enable',
          handler: () => {
            this.requestLocationPermissions();
          },
        },
      ],
    });

    await toast.present();
  }

  /**
   * Manual settings instructions.
   *
   * For now, this shows instructions instead of opening settings directly.
   * Opening app settings needs an extra plugin.
   */
  private async showNativeSettingsInstructions(): Promise<void> {
    const toast = await this.toastController.create({
      message:
        'Open your phone Settings > Apps > AllerAid > Permissions > Location > Allow.',
      duration: 8000,
      position: 'bottom',
      color: 'primary',
    });

    await toast.present();
  }
}