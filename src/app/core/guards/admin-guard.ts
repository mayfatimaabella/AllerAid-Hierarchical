import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

export const adminGuard: CanActivateFn = async () => {

  const authService = inject(AuthService);
  const userService = inject(UserService);
  const router = inject(Router);

  try {

    const currentUser = await authService.waitForAuthInit();

    if (!currentUser) {
      router.navigate(['/login']);
      return false;
    }

    const profile = await userService.getUserProfile(currentUser.uid);

    if (profile?.role === 'admin') {
      return true;
    }

    router.navigate(['tabs/home']);
    return false;

  } catch (error) {

    console.error('Admin guard error:', error);

    router.navigate(['/login']);
    return false;
  }
};