import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  async canActivate(): Promise<boolean> {
    // Uncommented authentication guard logic for production
    const user = await this.authService.waitForAuthInit();
    
    if (user) {
      return true;
    } else {
      console.log('AuthGuard: User not authenticated, redirecting to login');
      this.router.navigate(['/login']);
      return false;
    }
  }
}

