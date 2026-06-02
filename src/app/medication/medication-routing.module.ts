import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MedicationPage } from './medication.page';
import { MedicationDetailsComponent } from './medication-details/medication-details.component';
import { AddEditMedicationComponent } from './add-edit-medication/add-edit-medication.component';

const routes: Routes = [
  {
    path: '',
    component: MedicationPage
  },
  {
    path: 'details/:id',
    component: MedicationDetailsComponent
  },
  {
    path: 'add-edit',
    component: AddEditMedicationComponent
  },
  {
    path: 'add-edit/:id',
    component: AddEditMedicationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MedicationPageRoutingModule {}
