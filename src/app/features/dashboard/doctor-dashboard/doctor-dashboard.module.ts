import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { DoctorDashboardPageRoutingModule } from './doctor-dashboard-routing.module';
import { PatientAnalysisModalModule } from '../../../shared/modals/patient-analysis-modal.module';

import { DoctorDashboardPage } from './doctor-dashboard.page';
import { UserMenuPopover } from './user-menu-popover.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DoctorDashboardPageRoutingModule,
    PatientAnalysisModalModule
  ],
  declarations: [DoctorDashboardPage, UserMenuPopover]
})
export class DoctorDashboardPageModule {}




