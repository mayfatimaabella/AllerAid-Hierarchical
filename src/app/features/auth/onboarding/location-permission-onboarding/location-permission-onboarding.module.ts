import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LocationPermissionOnboardingPageRoutingModule } from './location-permission-onboarding-routing.module';

import { LocationPermissionOnboardingPage } from './location-permission-onboarding.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LocationPermissionOnboardingPageRoutingModule
  ],
  declarations: [LocationPermissionOnboardingPage]
})
export class LocationPermissionOnboardingPageModule {}
