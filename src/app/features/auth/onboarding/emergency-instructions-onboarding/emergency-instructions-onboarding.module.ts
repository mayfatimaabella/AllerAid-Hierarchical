import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { EmergencyInstructionsOnboardingPageRoutingModule } from './emergency-instructions-onboarding-routing.module';

import { EmergencyInstructionsOnboardingPage } from './emergency-instructions-onboarding.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EmergencyInstructionsOnboardingPageRoutingModule
  ],
  declarations: [EmergencyInstructionsOnboardingPage]
})
export class EmergencyInstructionsOnboardingPageModule {}
