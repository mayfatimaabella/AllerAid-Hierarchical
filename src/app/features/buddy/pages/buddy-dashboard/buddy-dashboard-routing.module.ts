import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BuddyDashboardPage } from './buddy-dashboard.page';

const routes: Routes = [
  {
    path: '',
    component: BuddyDashboardPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BuddyDashboardPageRoutingModule {}
