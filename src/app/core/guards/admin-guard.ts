import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';

import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

export const adminGuard: CanActivateFn = async () => {

  const authService = inject(AuthService);
  const userService = inject(UserService);
  const router = inject(Router);

  try {

    console.log('ADMIN GUARD STARTED');
    
    // Wait for Firebase to restore the login session
    const currentUser =
      await authService.waitForAuthInit();

    console.log(
      'Firebase user:',
      currentUser?.email
    );

    console.log(
      'Firebase UID:',
      currentUser?.uid
    );

    // No logged-in user
    if (!currentUser) {

      console.log(
        'ADMIN GUARD: No authenticated user'
      );

      return router.createUrlTree(['/login']);
    }

    // IMPORTANT:
    // false = do not use cached profile
    const profile =
      await userService.getUserProfile(
        currentUser.uid,
        false
      );

    console.log(
      'Firestore profile:',
      profile
    );

    console.log(
      'Firestore role:',
      profile?.role
    );

    console.log(
      'Role type:',
      typeof profile?.role
    );

    // Normalize the role
    const role =
      profile?.role
        ?.toString()
        .trim()
        .toLowerCase();

    console.log(
      'Normalized role:',
      role
    );

    // Admin
    if (role === 'admin') {

      console.log(
        'ADMIN ACCESS GRANTED'
      );

      return true;
    }

    console.log(
      'USER IS NOT ADMIN'
    );

    console.log(
      'Redirecting to /tabs/home'
    );

    return router.createUrlTree([
      '/tabs/home'
    ]);

  } catch (error) {

    console.error(
      'ADMIN GUARD ERROR:',
      error
    );

    return router.createUrlTree([
      '/login'
    ]);
  }
};