import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ManageAllergiesPage } from './manage-allergies.page';

const routes: Routes = [
  {
    path: '',
    component: ManageAllergiesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ManageAllergiesPageRoutingModule {}
