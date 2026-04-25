import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { BuddySetupOnboardingPage } from './buddy-setup-onboarding.page';

const routes: Routes = [
  {
    path: '',
    component: BuddySetupOnboardingPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class BuddySetupOnboardingPageRoutingModule {}
