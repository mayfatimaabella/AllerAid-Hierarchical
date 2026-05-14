import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

const routes: Routes = [
  {
    path: 'patient-invite',
    loadChildren: () => import('./patient-invite/patient-invite.module').then(m => m.PatientInvitePageModule)
  },
  {
    path: 'patient-profile/:id',
    loadChildren: () => import('./patient-profile/patient-profile.module').then(m => m.PatientProfilePageModule)
  },
  {
    path: 'doctor-profile',
    loadChildren: () => import('./doctor-profile/doctor-profile.module').then(m => m.DoctorProfilePageModule)
  },
  {
    path: '',
    redirectTo: 'patient-invite',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DoctorRoutingModule {}
