import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { VerifyDoctorsPage } from './verify-doctors.page';

const routes: Routes = [
  {
    path: '',
    component: VerifyDoctorsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VerifyDoctorsPageRoutingModule {}
