import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { EmergencyResponseNotificationComponent } from './emergency-response-notification.component';

@NgModule({
  declarations: [EmergencyResponseNotificationComponent],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [EmergencyResponseNotificationComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class EmergencyResponseNotificationModule { }
