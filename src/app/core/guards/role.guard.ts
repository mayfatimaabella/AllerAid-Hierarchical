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

    try {

      const user = await this.authService.waitForAuthInit();

      if (!user) {
        console.log('RoleGuard: User not authenticated');
        this.router.navigate(['/login']);
        return false;
      }

      const userProfile = await this.userService.getUserProfile(user.uid);

      if (!userProfile) {
        console.log('RoleGuard: User profile not found');

        await this.presentToast(
          'User profile not found. Redirecting to complete setup.'
        );

        this.router.navigate(['/registration']);
        return false;
      }

      if (!userProfile.role) {

        console.log('RoleGuard: User role is undefined');

        await this.presentToast(
          'User role not set. Please complete your profile setup.'
        );

        this.router.navigate(['/profile'], {
          queryParams: {
            tab: 'settings',
            setup: 'role'
          }
        });

        return false;
      }

      const requiredRoles = route.data['roles'] as string[];

      if (!requiredRoles || requiredRoles.length === 0) {
        return true;
      }

      if (userProfile.role === 'admin') {
        return true;
      }

      const hasRequiredRole = requiredRoles.includes(userProfile.role);

      if (hasRequiredRole) {
        return true;
      }

      console.log(
        `RoleGuard: User role '${userProfile.role}' not authorized for this page. Required: ${requiredRoles.join(', ')}`
      );

      await this.presentToast(
        `Access denied. This feature requires ${requiredRoles.join(' or ')} privileges.`
      );

      switch (userProfile.role) {

        case 'doctor':
          this.router.navigate(['/tabs/doctor-dashboard']);
          break;


        case 'user':
          this.router.navigate(['/tabs/home']);
          break;

        default:
          this.router.navigate(['/login']);
          break;
      }

      return false;

    } catch (error) {

      console.error('RoleGuard error:', error);

      await this.presentToast(
        'Error checking permissions. Please try again.'
      );

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