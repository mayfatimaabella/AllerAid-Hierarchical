import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { EmergenciesPageRoutingModule } from './emergency-center-routing.module';
import { EmergenciesPage } from './emergency-center.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    EmergenciesPageRoutingModule,
    EmergenciesPage
  ]
})
export class EmergenciesPageModule {}
