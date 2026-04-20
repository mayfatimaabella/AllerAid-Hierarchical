import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { PatientMapPageRoutingModule } from './patient-map-routing.module';
import { PatientMapPage } from './patient-map.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PatientMapPageRoutingModule
  ],
  declarations: [PatientMapPage]
})
export class PatientMapPageModule {}
