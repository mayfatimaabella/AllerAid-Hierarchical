import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AdminDashboardPage } from './admin-dashboard.page';

const routes: Routes = [
  {
    path: '',
    component: AdminDashboardPage
  },
  {
    path: 'doctors',
    loadComponent: () =>
      import('../verify-doctors/verify-doctors.page').then(m => m.VerifyDoctorsPage)
  },
    {
    path: 'emergencies',
    loadComponent: () =>
      import('../emergency-logs/emergency-logs.page')
        .then(m => m.EmergencyLogsPage)
  },
  {
  path: 'allergies',
  loadComponent: () =>
    import('../manage-allergies/manage-allergies.page')
      .then(m => m.ManageAllergiesPage)
}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminDashboardPageRoutingModule {}
