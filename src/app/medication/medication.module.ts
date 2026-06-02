import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { MedicationPageRoutingModule } from './medication-routing.module';

import { MedicationPage } from './medication.page';
import { MedicationDetailsComponent } from './medication-details/medication-details.component';
import { AddEditMedicationComponent } from './add-edit-medication/add-edit-medication.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MedicationPageRoutingModule
  ],
  declarations: [MedicationPage, MedicationDetailsComponent, AddEditMedicationComponent]
})
export class MedicationPageModule {}
