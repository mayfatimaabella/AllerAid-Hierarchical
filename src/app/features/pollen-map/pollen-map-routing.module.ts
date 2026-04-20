import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { PollenMapPage } from './pollen-map.page';

const routes: Routes = [
  {
    path: '',
    component: PollenMapPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PollenMapPageRoutingModule {}
