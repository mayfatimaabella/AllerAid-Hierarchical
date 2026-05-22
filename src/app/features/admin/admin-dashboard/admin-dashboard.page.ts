import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { AdminService } from '../../../core/services/admin';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
  ]
})
export class AdminDashboardPage implements OnInit {

  totalUsers: number = 0;
  pendingDoctors: number = 0;
  totalEmergencies: number = 0;

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.loadDashboardData();
  }

  private async loadDashboardData() {
    try {
      const users = await this.adminService.getAllUsers();
      console.log('ALL USERS:', users);

      this.totalUsers = users.length;

      const pendingDoctors =
        await this.adminService.getPendingDoctorVerificationRequests();

      console.log('PENDING DOCTORS:', pendingDoctors);

      this.pendingDoctors = pendingDoctors.length;
      this.totalEmergencies = 0;

    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  }
}