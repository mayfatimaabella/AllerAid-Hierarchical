import { Injectable } from '@angular/core';
import { EmergencyService } from './emergency.service';
import { AuthService } from './auth.service';
import { Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PatientNotificationService {
  private responseSubscription: Subscription | null = null;

  constructor(
    private emergencyService: EmergencyService,
    private authService: AuthService
  ) {}

  /**
   * Start listening for buddy responses for the current user
   */
  async startListeningForBuddyResponses(): Promise<void> {
    try {
      const user = await this.authService.waitForAuthInit();
      if (!user) {
        console.log('No authenticated user found');
        return;
      }

      // Check if already listening
      if (this.responseSubscription) {
        console.log('Already listening for buddy responses');
        return;
      }

      console.log('Starting to listen for buddy responses...');

      // Subscribe to emergency responses
      this.responseSubscription = this.emergencyService.emergencyResponse$.subscribe(
        (response: any) => {
          if (response) {
            console.log('Buddy response received:', response);
            // UI handling for buddy responses is now done by
            // feature screens (e.g. Home dashboard, patient map).
          }
        }
      );

    } catch (error) {
      console.error('Error starting buddy response listener:', error);
    }
  }

  /**
   * Stop listening for buddy responses
   */
  stopListeningForBuddyResponses(): void {
    if (this.responseSubscription) {
      this.responseSubscription.unsubscribe();
      this.responseSubscription = null;
      console.log('Stopped listening for buddy responses');
    }
  }

  /**
   * Check if currently listening for responses
   */
  isListening(): boolean {
    return this.responseSubscription !== null;
  }

  /**
   * Cleanup on service destruction
   */
  ngOnDestroy(): void {
    this.stopListeningForBuddyResponses();
  }
}