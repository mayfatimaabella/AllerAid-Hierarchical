import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { AdminUserService } from '../../../core/services/admin/admin-user';
import { AdminDoctorService } from '../../../core/services/admin/admin-doctor';
import { AdminEmergencyService } from '../../../core/services/admin/admin-emergency';

import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
  ]
})
export class AdminDashboardPage implements OnInit {

  totalUsers: number = 0;
  pendingDoctors: number = 0;
  totalEmergencies: number = 0;

  constructor(
    private adminUserService: AdminUserService,
    private adminDoctorService: AdminDoctorService,
    private adminEmergencyService: AdminEmergencyService,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    await this.loadDashboardData();
  }

  async ionViewWillEnter() {
    await this.loadDashboardData();
  }

private async loadDashboardData() {

  try {

    const users = await this.adminUserService.getAllUsers();
    this.totalUsers = users.length;

    const pendingDoctors =
      await this.adminDoctorService.getPendingDoctorVerificationRequests();

    this.pendingDoctors = pendingDoctors.length;

    const emergencies =
      await this.adminEmergencyService.getAllEmergencies();

    this.totalEmergencies = emergencies.length;

  } catch (error) {

    console.error('Dashboard load error:', error);
  }
}

async logout() {

  try {

    await this.authService.signOut();

    await this.router.navigate(['/login']);

  } catch (error) {

    console.error('Logout error:', error);
  }
}
}