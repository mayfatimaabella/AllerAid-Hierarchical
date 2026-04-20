import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { BuddyDashboardPageRoutingModule } from './buddy-dashboard-routing.module';
import { BuddyDashboardPage } from './buddy-dashboard.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BuddyDashboardPageRoutingModule,
    BuddyDashboardPage
  ]
})
export class BuddyDashboardPageModule {}
