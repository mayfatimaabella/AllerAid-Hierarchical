import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { SmartwatchPageRoutingModule } from './smartwatch-routing.module';

import { SmartwatchPage } from './smartwatch.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SmartwatchPageRoutingModule
  ],
  declarations: [SmartwatchPage]
})
export class SmartwatchPageModule {}
