import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ResponderMapPage } from './responder-map.page';

const routes: Routes = [
  {
    path: '',
    component: ResponderMapPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ResponderMapPageRoutingModule {}




