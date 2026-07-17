import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot
} from '@angular/router';
import { ToastController } from '@ionic/angular';

import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

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

  async canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {

    try {

      const authUser = await this.authService.waitForAuthInit();

      if (!authUser) {
        console.log('RoleGuard: User not authenticated');
        await this.router.navigate(['/login']);
        return false;
      }

      const userProfile = await this.userService.getUserProfile(authUser.uid);

      if (!userProfile) {
        console.log('RoleGuard: User profile not found');

        await this.presentToast(
          'User profile not found. Please complete registration.'
        );

        await this.router.navigate(['/registration']);
        return false;
      }

      if (!userProfile.role) {

        await this.presentToast(
          'User role is missing.'
        );

        await this.router.navigate(['/profile'], {
          queryParams: {
            tab: 'settings',
            setup: 'role'
          }
        });

        return false;
      }

      const requiredRoles =
        (route.data['roles'] as string[]) ?? [];

      // No roles required
      if (requiredRoles.length === 0) {
        return true;
      }

      // Admin bypass
      if (userProfile.role === 'admin') {
        return true;
      }

      console.log('Route:', state.url);
      console.log('Current Role:', userProfile.role);
      console.log('Required Roles:', requiredRoles);

      if (requiredRoles.includes(userProfile.role)) {
        return true;
      }

      await this.presentToast(
        `Access denied. Required role: ${requiredRoles.join(', ')}`
      );

      switch (userProfile.role) {

        case 'doctor':
          await this.router.navigate(['/tabs/doctor-dashboard']);
          break;

        case 'user':
          await this.router.navigate(['/tabs/home']);
          break;

        default:
          await this.router.navigate(['/login']);
          break;
      }

      return false;

    } catch (error) {

      console.error('RoleGuard Error:', error);

      await this.presentToast(
        'Unable to verify permissions.'
      );

      await this.router.navigate(['/login']);

      return false;
    }
  }

  private async presentToast(message: string): Promise<void> {

    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'warning'
    });

    await toast.present();
  }
}