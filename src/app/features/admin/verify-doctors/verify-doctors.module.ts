import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { VerifyDoctorsPageRoutingModule } from './verify-doctors-routing.module';


@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VerifyDoctorsPageRoutingModule
  ],
})
export class VerifyDoctorsPageModule {}
