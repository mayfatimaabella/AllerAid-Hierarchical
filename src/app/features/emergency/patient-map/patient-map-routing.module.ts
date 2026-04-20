import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PatientMapPage } from './patient-map.page';

const routes: Routes = [
  {
    path: '',
    component: PatientMapPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PatientMapPageRoutingModule {}
