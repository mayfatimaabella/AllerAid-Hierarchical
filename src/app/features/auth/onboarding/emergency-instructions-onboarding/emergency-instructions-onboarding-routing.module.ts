import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { EmergencyInstructionsOnboardingPage } from './emergency-instructions-onboarding.page';

const routes: Routes = [
  {
    path: '',
    component: EmergencyInstructionsOnboardingPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EmergencyInstructionsOnboardingPageRoutingModule {}
