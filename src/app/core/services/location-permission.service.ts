import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationPermissionResult {
  granted: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocationPermissionService {

  constructor(
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  /**
   * Request location permissions with user-friendly handling
   */
  async requestLocationPermissions(): Promise<LocationPermissionResult> {
    if (Capacitor.isNativePlatform()) {
      return this.requestNativePermissions();
    } else {
      return this.checkBrowserPermissions();
    }
  }

  /**
   * Handle native (mobile) location permissions
   */
  private async requestNativePermissions(): Promise<LocationPermissionResult> {
    try {
      // Check if geolocation is available
      if (!Capacitor.isPluginAvailable('Geolocation')) {
        return {
          granted: false,
          message: 'Location services are not available on this device'
        };
      }

      // Request permissions
      const permissions = await Geolocation.requestPermissions();
      
      if (permissions.location === 'granted') {
        return { granted: true };
      } else if (permissions.location === 'denied') {
        await this.showPermissionDeniedAlert();
        return {
          granted: false,
          message: 'Location permission denied. Please enable in device settings.'
        };
      } else {
        return {
          granted: false,
          message: 'Location permission not granted'
        };
      }
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return {
        granted: false,
        message: 'Error requesting location permissions'
      };
    }
  }

  /**
   * Check browser location permissions
   */
  private async checkBrowserPermissions(): Promise<LocationPermissionResult> {
    if (!navigator.geolocation) {
      return {
        granted: false,
        message: 'Location services are not supported by this browser'
      };
    }

    // For browsers, we can't directly request permissions
    // The permission dialog appears when we first call getCurrentPosition or watchPosition
    // We'll test with a quick position check
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          resolve({ granted: true });
        },
        async (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            await this.showBrowserPermissionAlert();
            resolve({
              granted: false,
              message: 'Location access denied. Please allow location access in your browser.'
            });
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            resolve({
              granted: false,
              message: 'Location information is unavailable. Please check your location settings.'
            });
          } else if (error.code === error.TIMEOUT) {
            resolve({
              granted: false,
              message: 'Location request timed out. Please try again.'
            });
          } else {
            resolve({
              granted: false,
              message: 'Unable to retrieve location. Please check your location settings.'
            });
          }
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 60000
        }
      );
    });
  }

  /**
   * Show alert for native permission denial
   */
  private async showPermissionDeniedAlert() {
    const alert = await this.alertController.create({
      header: 'Location Permission Required',
      message: 'AllerAid needs location access to provide emergency assistance. Please enable location permissions in your device settings.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Open Settings',
          handler: () => {
            // On mobile, this would open the app settings
            // The exact implementation depends on the platform
            this.openAppSettings();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Show alert for browser permission issues
   */
  private async showBrowserPermissionAlert() {
    const alert = await this.alertController.create({
      header: 'Location Access Required',
      message: 'AllerAid needs location access to provide emergency assistance. Please allow location access when prompted by your browser, or check that location services are enabled.',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        },
        {
          text: 'Try Again',
          handler: () => {
            // Trigger another permission request
            this.requestLocationPermissions();
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Show informative toast about location requirements
   */
  async showLocationRequiredToast() {
    const toast = await this.toastController.create({
      message: 'Location access is required for emergency tracking',
      duration: 4000,
      position: 'bottom',
      color: 'warning',
      buttons: [
        {
          text: 'Enable',
          handler: () => {
            this.requestLocationPermissions();
          }
        }
      ]
    });

    await toast.present();
  }

  /**
   * Open app settings (platform-specific)
   */
  private openAppSettings() {
    if (Capacitor.isNativePlatform()) {
      // This would require additional Capacitor plugins like @capacitor/app
      // For now, just show a toast with instructions
      this.showSettingsInstructions();
    }
  }

  /**
   * Show instructions for manually enabling location
   */
  private async showSettingsInstructions() {
    const toast = await this.toastController.create({
      message: 'Go to Settings > Privacy & Security > Location Services > AllerAid > Allow Location Access',
      duration: 8000,
      position: 'bottom',
      color: 'primary'
    });

    await toast.present();
  }

  /**
   * Check if location is currently available (quick test)
   */
  async isLocationAvailable(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const permissions = await Geolocation.checkPermissions();
        return permissions.location === 'granted';
      } catch (error) {
        return false;
      }
    } else {
      return navigator.geolocation !== undefined;
    }
  }
}