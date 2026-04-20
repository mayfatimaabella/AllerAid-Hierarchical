import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ResponderDashboardPageRoutingModule } from './responder-dashboard-routing.module';

import { ResponderDashboardPage } from './responder-dashboard.page';
import { ResponderMapPageModule } from '../../emergency/responder-map/responder-map.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ResponderDashboardPageRoutingModule,
    ResponderMapPageModule
  ],
  declarations: [ResponderDashboardPage]
})
export class ResponderDashboardPageModule {}




