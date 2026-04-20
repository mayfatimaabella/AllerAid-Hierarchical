import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AllergyOnboardingPageRoutingModule } from './allergy-onboarding-routing.module';

import { AllergyOnboardingPage } from './allergy-onboarding.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AllergyOnboardingPageRoutingModule
  ],
  declarations: [AllergyOnboardingPage]
})
export class AllergyOnboardingPageModule {}




