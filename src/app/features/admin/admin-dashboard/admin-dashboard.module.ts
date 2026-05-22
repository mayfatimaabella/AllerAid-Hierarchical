import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AdminDashboardPageRoutingModule } from './admin-dashboard-routing.module';

import { AdminDashboardPage } from './admin-dashboard.page';

@NgModule({
  imports: [
    FormsModule,
    IonicModule,
    AdminDashboardPageRoutingModule,
    AdminDashboardPage
  ],
  declarations: []
})
export class AdminDashboardPageModule {}
