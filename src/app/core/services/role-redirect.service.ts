import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class RoleRedirectService {

  constructor(
    private router: Router,
    private authService: AuthService,
    private userService: UserService
  ) {}

  async redirectBasedOnRole(): Promise<void> {
    try {
      const user = await this.authService.waitForAuthInit();
      
      if (!user) {
        this.router.navigate(['/login']);
        return;
      }

      const userProfile = await this.userService.getUserProfile(user.uid);
      
      if (!userProfile) {
        this.router.navigate(['/login']);
        return;
      }

      // Redirect based on role
      switch (userProfile.role) {
        case 'buddy':
          this.router.navigate(['/tabs/responder-dashboard']);
          break;
        case 'doctor':
        case 'nurse':
          this.router.navigate(['/tabs/doctor-dashboard']);
          break;
        case 'user':
        default:
          this.router.navigate(['/tabs/home']);
          break;
      }
    } catch (error) {
      console.error('Error in role-based redirect:', error);
      this.router.navigate(['/login']);
    }
  }

  getDefaultTabForRole(role: string): string {
    switch (role) {
      case 'buddy':
        return '/tabs/responder-dashboard';
      case 'doctor':
      case 'nurse':
        return '/tabs/doctor-dashboard';
      case 'user':
      default:
        return '/tabs/home';
    }
  }
}
