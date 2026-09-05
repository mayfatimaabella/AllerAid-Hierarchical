import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BuddyPage } from './pages/buddy.page';

const routes: Routes = [
  {
    path: '',
    component: BuddyPage
  },
{
  path: 'emergency-history-details/:id',
  loadComponent: () =>
    import('./pages/emergency-history-details/emergency-history-details.page')
      .then(m => m.EmergencyHistoryDetailsPage)
}


];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BuddyPageRoutingModule {}




