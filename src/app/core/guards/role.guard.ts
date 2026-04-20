import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private toastController: ToastController
  ) {}
  
  async canActivate(route: ActivatedRouteSnapshot): Promise<boolean> {
    // Uncommented role guard logic for production
    try {
      const user = await this.authService.waitForAuthInit();
      if (!user) {
        console.log('RoleGuard: User not authenticated, redirecting to login');
        this.router.navigate(['/login']);
        return false;
      }
      const userProfile = await this.userService.getUserProfile(user.uid);
      if (!userProfile) {
        console.log('RoleGuard: User profile not found, redirecting to profile creation');
        this.presentToast('User profile not found. Redirecting to complete setup.');
        this.router.navigate(['/registration']);
        return false;
      }
      if (!userProfile.role || userProfile.role === 'undefined') {
        console.log('RoleGuard: User role is undefined, redirecting to profile setup');
        this.presentToast('User role not set. Please complete your profile setup.');
        this.router.navigate(['/profile'], { queryParams: { tab: 'settings', setup: 'role' } });
        return false;
      }
      const requiredRoles = route.data['roles'] as string[];
      if (!requiredRoles || requiredRoles.length === 0) {
        return true;
      }
      const hasRequiredRole = requiredRoles.includes(userProfile.role);
      if (hasRequiredRole) {
        return true;
      } else {
        console.log(`RoleGuard: User role '${userProfile.role}' not authorized for this page. Required: ${requiredRoles.join(', ')}`);
        this.presentToast(`Access denied. This feature requires ${requiredRoles.join(' or ')} privileges.`);
        switch (userProfile.role) {
          case 'doctor':
          case 'nurse':
            this.router.navigate(['/tabs/doctor-dashboard']);
            break;
          case 'buddy':
            this.router.navigate(['/tabs/responder-dashboard']);
            break;
          case 'user':
          default:
            this.router.navigate(['/tabs/home']);
            break;
        }
        return false;
      }
    } catch (error) {
      console.error('RoleGuard error:', error);
      this.presentToast('Error checking permissions. Please try again.');
      this.router.navigate(['/login']);
      return false;
    }
  }

  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 4000,
      position: 'bottom',
      color: 'warning'
    });
    await toast.present();
  }
}

