import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { MedicalHistoryDetailsPageRoutingModule } from './medical-history-details-routing.module';
import { MedicalHistoryDetailsPage } from '../medical-history/medical-history-details.page';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		IonicModule,
		MedicalHistoryDetailsPageRoutingModule
	],
	declarations: [MedicalHistoryDetailsPage]
})
export class MedicalHistoryDetailsPageModule {}
