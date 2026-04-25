import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';


const routes: Routes = [
  {
    path: 'verify-email',
    loadChildren: () => import('./features/auth/verify-email/verify-email.module').then(m => m.VerifyEmailPageModule)
  },
  {
    path: 'alerts',
    loadChildren: () => import('./features/buddy/pages/emergencies/emergencies.module').then(m => m.EmergenciesPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'registration',
    loadChildren: () => import('./features/auth/registration/registration.module').then( m => m.RegistrationPageModule)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'home',
    loadChildren: () => import('./features/dashboard/home-dashboard/home.module').then( m => m.HomePageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./features/auth/login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'scan',
    loadChildren: () => import('./features/scan/scan.module').then( m => m.ScanPageModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['user'] }
  },
  {

    path: 'profile',
    loadChildren: () => import('./features/profile/profile.module').then( m => m.ProfilePageModule)
  },
  {
    path: 'tabs',
    loadChildren: () => import('./layout/tabs/tabs.module').then( m => m.TabsPageModule),
    canActivate: [AuthGuard]
  },
  {

    path: 'buddy',
    loadChildren: () => import('./features/buddy/buddy.module').then( m => m.BuddyPageModule),
    canActivate: [AuthGuard]
  },
  {

    path: 'allergy-onboarding',
    loadChildren: () => import('./features/auth/onboarding/allergy-onboarding/allergy-onboarding.module').then( m => m.AllergyOnboardingPageModule)
  },
  {
    path: 'emergency-instructions-onboarding',
    loadChildren: () => import('./features/auth/onboarding/emergency-instructions-onboarding/emergency-instructions-onboarding.module').then( m => m.EmergencyInstructionsOnboardingPageModule)
  },
  {
    path: 'buddy-setup-onboarding',
    loadChildren: () => import('./features/auth/onboarding/buddy-setup-onboarding/buddy-setup-onboarding.module').then( m => m.BuddySetupOnboardingPageModule)
  },
  {
    path: 'notification',
    loadChildren: () => import('./features/notification/notification.module').then( m => m.NotificationPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'responder-dashboard',
    loadChildren: () => import('./features/dashboard/responder-dashboard/responder-dashboard.module').then( m => m.ResponderDashboardPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'responder-map',
    loadChildren: () => import('./features/emergency/responder-map/responder-map.module').then( m => m.ResponderMapPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'patient-map',
    loadChildren: () => import('./features/emergency/patient-map/patient-map.module').then( m => m.PatientMapPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'doctor-dashboard',
    loadChildren: () => import('./features/dashboard/doctor-dashboard/doctor-dashboard.module').then( m => m.DoctorDashboardPageModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['doctor', 'nurse'] }
  },
  {
    path: 'visit-details/:id',
    loadChildren: () => import('./features/profile/ehr/pages/doctor-visit-details/doctor-visit-details.module').then( m => m.VisitDetailsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'medical-history-details/:id',
    loadChildren: () => import('./features/profile/ehr/pages/medical-history/medical-history-details.module').then( m => m.MedicalHistoryDetailsPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'smartwatch',
    loadChildren: () => import('./features/smartwatch/smartwatch.module').then( m => m.SmartwatchPageModule)
  },
  {
    path: 'pollen-map',
    loadChildren: () => import('./features/pollen-map/pollen-map.module').then( m => m.PollenMapPageModule)
  },




];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }