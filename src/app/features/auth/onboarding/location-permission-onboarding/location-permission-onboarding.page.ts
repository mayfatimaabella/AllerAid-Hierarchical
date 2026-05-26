import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Platform, ToastController } from '@ionic/angular';
import { AuthService } from '../../../../core/services/auth.service';
import { LocationPermissionService } from '../../../../core/services/location-permission.service';
import { MedicalService } from '../../../../core/services/medical.profile.service';
import { FirebaseService } from '../../../../core/services/firebase.service';
import { EmergencyService } from '../../../../core/services/emergency.service';
import { Subscription } from 'rxjs';
import { doc, setDoc } from 'firebase/firestore';

@Component({
  selector: 'app-location-permission-onboarding',
  templateUrl: './location-permission-onboarding.page.html',
  styleUrls: ['./location-permission-onboarding.page.scss'],
  standalone: false,
})
export class LocationPermissionOnboardingPage implements OnInit, OnDestroy {
  isLoading = true;
  isSaving = false;
  locationPermissionGranted = false;
  hasPermissionAttempted = false;

  private backButtonSubscription?: Subscription;
  private db;

  constructor(
    private router: Router,
    private platform: Platform,
    private authService: AuthService,
    private locationPermissionService: LocationPermissionService,
    private medicalService: MedicalService,
    private firebaseService: FirebaseService,
    private toastController: ToastController,
    private emergencyService: EmergencyService
  ) {
    this.db = this.firebaseService.getDb();
  }

  async ngOnInit(): Promise<void> {
    await this.checkExistingPermissionStatus();
  }

  ionViewDidEnter(): void {
    this.enableBackNavigationBlock();
  }

  ionViewWillLeave(): void {
    this.disableBackNavigationBlock();
  }

  ngOnDestroy(): void {
    this.disableBackNavigationBlock();
  }

  private onPopState = (): void => {
    history.pushState(null, '', window.location.href);
  };

  private enableBackNavigationBlock(): void {
    this.disableBackNavigationBlock();
    this.backButtonSubscription = this.platform.backButton.subscribeWithPriority(9999, () => {});
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', this.onPopState);
  }

  private disableBackNavigationBlock(): void {
    this.backButtonSubscription?.unsubscribe();
    window.removeEventListener('popstate', this.onPopState);
  }

  async goBack(): Promise<void> {
    this.disableBackNavigationBlock();
    await this.router.navigate(['/buddy-setup-onboarding'], { replaceUrl: true });
  }

  private async checkExistingPermissionStatus(): Promise<void> {
    try {
      const isAvailable = await this.locationPermissionService.isLocationAvailable();
      this.locationPermissionGranted = isAvailable;
    } catch (error) {
      console.error('Error checking location permission status:', error);
      this.locationPermissionGranted = false;
    } finally {
      this.isLoading = false;
    }
  }

  async requestLocationPermission(): Promise<void> {
    try {
      this.isSaving = true;
      this.hasPermissionAttempted = true;

      const result = await this.locationPermissionService.requestLocationPermissions();

      if (result.granted) {
        this.locationPermissionGranted = true;
        await this.showToast('Location permission granted successfully!', 'success');
      } else {
        this.locationPermissionGranted = false;
        await this.showToast(result.message || 'Location permission was not granted.', 'warning');
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      await this.showToast('An error occurred while requesting location permission.', 'danger');
      this.locationPermissionGranted = false;
    } finally {
      this.isSaving = false;
    }
  }

  async continueWithoutPermission(): Promise<void> {
    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in.', 'danger');
        return;
      }

      // Save that user skipped location permission during onboarding
      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          locationPermissionOnboarding: {
            completed: true,
            permissionGranted: false,
            skippedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      await this.medicalService.markAllergyOnboardingCompleted(currentUser.uid);
      await this.showToast('Setup complete. You can enable location later in settings.', 'success');
      await this.router.navigate(['/tabs/home'], { replaceUrl: true });
    } catch (error) {
      console.error('Error skipping location permission:', error);
      await this.showToast('Something went wrong. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async finishWithPermission(): Promise<void> {
    try {
      this.isSaving = true;

      const currentUser = await this.authService.waitForAuthInit();

      if (!currentUser) {
        await this.showToast('You must be logged in.', 'danger');
        return;
      }

      // Start background location tracking immediately
      // This caches location so emergencies have instant access with no waiting time
      await this.emergencyService.startBackgroundLocationTracking();

      // Save that user granted location permission during onboarding
      await setDoc(
        doc(this.db, 'users', currentUser.uid, 'medical', 'info'),
        {
          locationPermissionOnboarding: {
            completed: true,
            permissionGranted: true,
            grantedAt: new Date(),
            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      await this.medicalService.markAllergyOnboardingCompleted(currentUser.uid);
      await this.showToast('Setup complete. Location tracking is now enabled.', 'success');
      await this.router.navigate(['/tabs/home'], { replaceUrl: true });
    } catch (error) {
      console.error('Error finishing location permission setup:', error);
      await this.showToast('Something went wrong. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'warning' | 'danger'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2600,
      color,
      position: 'bottom'
    });

    await toast.present();
  }
}
