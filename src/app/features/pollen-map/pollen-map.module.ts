import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PollenMapPageRoutingModule } from './pollen-map-routing.module';

import { PollenMapPage } from './pollen-map.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PollenMapPageRoutingModule
  ],
  declarations: [PollenMapPage]
})
export class PollenMapPageModule {}
