import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AllergyOnboardingPage } from './allergy-onboarding.page';

const routes: Routes = [
  {
    path: '',
    component: AllergyOnboardingPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AllergyOnboardingPageRoutingModule {}




