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
},
{
  path: 'users',
    loadComponent: () =>
      import('../manage-users/manage-users.page').then(m => m.ManageUsersPage)
},
{
  path: 'allergy-categories',
  loadComponent: () =>
    import('../manage-allergy-categories/manage-allergy-categories.page')
      .then(m => m.ManageAllergyCategoriesPage)
},
{
  path: 'emergency-hotlines',
  loadComponent: () =>
    import('../manage-emergency-hotlines/manage-emergency-hotlines.page')
      .then(m => m.ManageEmergencyHotlinesPage)
}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AdminDashboardPageRoutingModule {}
