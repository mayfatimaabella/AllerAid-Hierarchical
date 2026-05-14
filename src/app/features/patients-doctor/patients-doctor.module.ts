import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { PatientsDoctorPageRoutingModule } from './patients-doctor-routing.module';

import { PatientsDoctorPage } from './pages/patients-doctor.page';
import { 
  DoctorActionsModalComponent,
  DoctorEditModalComponent,
  DoctorDeleteConfirmModalComponent,
  DoctorDetailsModalComponent
} from './components';
import { DoctorInviteModalComponent } from './components/doctor-invite-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    PatientsDoctorPageRoutingModule
  ],
  declarations: [
    PatientsDoctorPage,
    DoctorActionsModalComponent,
    DoctorEditModalComponent,
    DoctorDeleteConfirmModalComponent,
    DoctorDetailsModalComponent,
    DoctorInviteModalComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PatientsDoctorPageModule {}
