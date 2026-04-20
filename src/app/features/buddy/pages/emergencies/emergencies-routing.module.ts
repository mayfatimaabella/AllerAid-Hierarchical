import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EmergenciesPage } from './emergencies.page';

const routes: Routes = [
  {
    path: '',
    component: EmergenciesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EmergenciesPageRoutingModule {}
