import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserProfile } from '../../../core/services/user.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileNavigationService {
  selectedTab: string = 'overview';
  userHasSelectedTab: boolean = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  /**
   * Set default tab based on user role
   */
  setDefaultTabForRole(userProfile: UserProfile | null): void {
    if (!this.userHasSelectedTab && userProfile?.role === 'doctor') {
      this.selectedTab = 'dashboard';
    }
  }

  /**
   * Select a tab
   */
  selectTab(tab: string): void {
    this.selectedTab = tab;
    this.userHasSelectedTab = true;
  }

  /**
   * Navigate to doctor dashboard
   */
  async navigateToDoctorDashboard(userProfile: UserProfile | null): Promise<void> {
    if (userProfile?.role === 'doctor') {
      await this.router.navigate(['/tabs/doctor-dashboard']);
    }
  }

  /**
   * Navigate to responder dashboard
   */
  navigateToResponderDashboard(): void {
    this.router.navigate(['/tabs/responder-dashboard']);
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }
}

