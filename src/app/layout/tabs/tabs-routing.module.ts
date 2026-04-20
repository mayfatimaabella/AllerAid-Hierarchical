import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RoleGuard } from '../../core/guards/role.guard';

import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      { 
        path: 'home', 
        loadChildren: () => import('../../features/dashboard/home-dashboard/home.module').then(m => m.HomePageModule),
        canActivate: [RoleGuard],
        data: { roles: ['user', 'buddy'] }
      },
      {
        path: 'scan',
        loadChildren: () => import('../../features/scan/scan.module').then(m => m.ScanPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['user'] }
      },
      {
        path: 'smartwatch',
        loadChildren: () => import('../../features/smartwatch/smartwatch.module').then(m => m.SmartwatchPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['user'] }
      },
      
      // Buddy Routes
      {
        path: 'emergencies',
        loadChildren: () => import('../../features/buddy/pages/emergencies/emergencies.module').then(m => m.EmergenciesPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['buddy'] }
      },
      {
        path: 'patients',
        loadChildren: () => import('../../features/buddy/pages/patients/patients.module').then(m => m.PatientsPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['buddy'] }
      },
      
      // Doctor/Nurse Routes
      {
        path: 'doctor-dashboard',
        loadChildren: () => import('../../features/dashboard/doctor-dashboard/doctor-dashboard.module').then(m => m.DoctorDashboardPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['doctor', 'nurse'] }
      },
      {
        path: 'smartwatch',
        loadChildren: () => import('../../features/smartwatch/smartwatch.module').then(m => m.SmartwatchPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['doctor', 'nurse'] }
      },
      {
        path: 'responder-dashboard',
        loadChildren: () => import('../../features/dashboard/responder-dashboard/responder-dashboard.module').then(m => m.ResponderDashboardPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['buddy'] }
      },
      {
        path: 'responder-map',
        loadChildren: () => import('../../features/emergency/responder-map/responder-map.module').then(m => m.ResponderMapPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['buddy'] }
      },
      {
        path: 'patient-map',
        loadChildren: () => import('../../features/emergency/patient-map/patient-map.module').then(m => m.PatientMapPageModule),
        canActivate: [RoleGuard],
        data: { roles: ['patient', 'user', 'default', 'all'] }
      },
      
      // Shared Routes (Available to multiple roles)
      {
        path: 'alerts',
        loadChildren: () => import('../../features/buddy/pages/emergencies/emergencies.module').then(m => m.EmergenciesPageModule)
      },
      {
        path: 'buddy',
        loadChildren: () => import('../../features/buddy/buddy.module').then(m => m.BuddyPageModule)  
      },
      {
        path: 'profile',
        loadChildren: () => import('../../features/profile/profile.module').then(m => m.ProfilePageModule)
      },
      {
        path: 'notification',
        loadChildren: () => import('../../features/notification/notification.module').then(m => m.NotificationPageModule)
      },
      {
        path: 'pollen-map',
        loadChildren: () => import('../../features/pollen-map/pollen-map.module').then(m => m.PollenMapPageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/home', // Default - will be overridden by role logic
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabsPageRoutingModule {}
