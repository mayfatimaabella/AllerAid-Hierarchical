import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PatientsDoctorPage } from './pages/patients-doctor.page';

const routes: Routes = [
  {
    path: '',
    component: PatientsDoctorPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PatientsDoctorPageRoutingModule {}
