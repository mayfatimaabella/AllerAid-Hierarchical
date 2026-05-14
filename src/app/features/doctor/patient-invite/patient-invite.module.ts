import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PatientInvitePageRoutingModule } from './patient-invite-routing.module';
import { PatientInvitePage } from './patient-invite.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    PatientInvitePageRoutingModule
  ],
  declarations: [PatientInvitePage]
})
export class PatientInvitePageModule {}
