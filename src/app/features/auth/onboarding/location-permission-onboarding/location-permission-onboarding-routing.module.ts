import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { LocationPermissionOnboardingPage } from './location-permission-onboarding.page';

const routes: Routes = [
  {
    path: '',
    component: LocationPermissionOnboardingPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LocationPermissionOnboardingPageRoutingModule {}
