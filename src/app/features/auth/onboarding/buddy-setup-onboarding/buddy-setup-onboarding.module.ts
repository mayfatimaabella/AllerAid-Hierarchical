import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BuddySetupOnboardingPageRoutingModule } from './buddy-setup-onboarding-routing.module';

import { BuddySetupOnboardingPage } from './buddy-setup-onboarding.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BuddySetupOnboardingPageRoutingModule
  ],
  declarations: [BuddySetupOnboardingPage]
})
export class BuddySetupOnboardingPageModule {}
