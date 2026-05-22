import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EmergencyLogsPage } from './emergency-logs.page';

const routes: Routes = [
  {
    path: '',
    component: EmergencyLogsPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EmergencyLogsPageRoutingModule {}
