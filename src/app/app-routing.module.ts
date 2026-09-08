import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { adminGuard } from './core/guards/admin-guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  // Authentication
  {
    path: 'login',
    loadChildren: () =>
      import('./features/auth/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'registration',
    loadChildren: () =>
      import('./features/auth/registration/registration.module').then(m => m.RegistrationPageModule)
  },
  {
    path: 'verify-email',
    loadChildren: () =>
      import('./features/auth/verify-email/verify-email.module').then(m => m.VerifyEmailPageModule)
  },

  // Main Tabs
  {
    path: 'tabs',
    loadChildren: () =>
      import('./layout/tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [AuthGuard]
  },

  // Home
  {
    path: 'home',
    loadChildren: () =>
      import('./features/dashboard/home-dashboard/home.module').then(m => m.HomePageModule),
    canActivate: [AuthGuard]
  },

  // Profile
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/profile/profile.module').then(m => m.ProfilePageModule),
    canActivate: [AuthGuard]
  },

  // Scan
  {
    path: 'scan',
    loadChildren: () =>
      import('./features/scan/scan.module').then(m => m.ScanPageModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['user'] }
  },

  // Buddy
  {
    path: 'buddy',
    loadChildren: () =>
      import('./features/buddy/buddy.module').then(m => m.BuddyPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'alerts',
    loadChildren: () =>
      import('./features/buddy/pages/emergencies/emergency-center.module').then(m => m.EmergenciesPageModule),
    canActivate: [AuthGuard]
  },

  // Responder
  {
    path: 'responder-dashboard',
    loadChildren: () =>
      import('./features/dashboard/responder-dashboard/responder-dashboard.module').then(m => m.ResponderDashboardPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'responder-map',
    loadChildren: () =>
      import('./features/emergency/responder-map/responder-map.module').then(m => m.ResponderMapPageModule),
    canActivate: [AuthGuard]
  },

  // Doctor
  {
    path: 'doctor-dashboard',
    loadChildren: () =>
      import('./features/dashboard/doctor-dashboard/doctor-dashboard.module').then(m => m.DoctorDashboardPageModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['doctor'] }
  },
  {
    path: 'doctor',
    loadChildren: () =>
      import('./features/doctor/doctor.module').then(m => m.DoctorModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['doctor'] }
  },

  // Admin
  {
    path: 'admin-dashboard',
    loadChildren: () =>
      import('./features/admin/admin-dashboard/admin-dashboard.module').then(m => m.AdminDashboardPageModule),
    canActivate: [adminGuard],
    data: { roles: ['admin'] }
  },

  // Medication
  {
    path: 'medication',
    loadChildren: () =>
      import('./medication/medication.module').then(m => m.MedicationPageModule)
  },

  // Smartwatch
  {
    path: 'smartwatch',
    loadChildren: () =>
      import('./features/smartwatch/smartwatch.module').then(m => m.SmartwatchPageModule)
  },

  // Pollen Map
  {
    path: 'pollen-map',
    loadChildren: () =>
      import('./features/pollen-map/pollen-map.module').then(m => m.PollenMapPageModule)
  },

  // Notification
  {
    path: 'notification',
    loadChildren: () =>
      import('./features/notification/notification.module').then(m => m.NotificationPageModule),
    canActivate: [AuthGuard]
  },

  // Patients
  {
    path: 'patients-doctor',
    loadChildren: () =>
      import('./features/patients-doctor/patients-doctor.module').then(m => m.PatientsDoctorPageModule)
  },

  // Visit Details
  {
    path: 'visit-details/:id',
    loadChildren: () =>
      import('./features/profile/ehr/pages/doctor-visit-details/doctor-visit-details.module').then(m => m.VisitDetailsPageModule),
    canActivate: [AuthGuard]
  },

  // Medical History
  {
    path: 'medical-history-details/:id',
    loadChildren: () =>
      import('./features/profile/ehr/pages/medical-history/medical-history-details.module').then(m => m.MedicalHistoryDetailsPageModule),
    canActivate: [AuthGuard]
  },

  // Onboarding
  {
    path: 'allergy-onboarding',
    loadChildren: () =>
      import('./features/auth/onboarding/allergy-onboarding/allergy-onboarding.module').then(m => m.AllergyOnboardingPageModule)
  },
  {
    path: 'emergency-instructions-onboarding',
    loadChildren: () =>
      import('./features/auth/onboarding/emergency-instructions-onboarding/emergency-instructions-onboarding.module').then(m => m.EmergencyInstructionsOnboardingPageModule)
  },
  {
    path: 'buddy-setup-onboarding',
    loadChildren: () =>
      import('./features/auth/onboarding/buddy-setup-onboarding/buddy-setup-onboarding.module').then(m => m.BuddySetupOnboardingPageModule)
  },
  {
    path: 'location-permission-onboarding',
    loadChildren: () =>
      import('./features/auth/onboarding/location-permission-onboarding/location-permission-onboarding.module').then(m => m.LocationPermissionOnboardingPageModule)
  },

  // Wildcard

{
  path: 'emergency-history-details/:id',
  loadComponent: () =>
    import('./features/buddy/pages/emergency-history-details/emergency-history-details.page')
      .then(m => m.EmergencyHistoryDetailsPage),
  canActivate: [AuthGuard]
},


  {
    path: '**',
    redirectTo: 'login'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: PreloadAllModules
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}