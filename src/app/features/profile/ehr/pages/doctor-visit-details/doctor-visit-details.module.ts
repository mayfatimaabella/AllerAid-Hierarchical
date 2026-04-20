import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { VisitDetailsPageRoutingModule } from './doctor-visit-details-routing.module';
import { VisitDetailsPage } from './doctor-visit-details.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    VisitDetailsPageRoutingModule
  ],
  declarations: [VisitDetailsPage]
})
export class VisitDetailsPageModule {}
