import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MedicalHistoryDetailsPage } from './medical-history-details.page';

const routes: Routes = [
  {
    path: '',
    component: MedicalHistoryDetailsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MedicalHistoryDetailsPageRoutingModule {}
