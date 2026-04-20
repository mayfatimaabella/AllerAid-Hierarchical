import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { PatientAnalysisModal } from './patient-analysis.modal';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  declarations: [PatientAnalysisModal],
  exports: [PatientAnalysisModal]
})
export class PatientAnalysisModalModule {}
