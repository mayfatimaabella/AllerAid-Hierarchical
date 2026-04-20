import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';

import { ScanPageRoutingModule } from './scan-routing.module';
import { ScanPage } from './scan.page';
import { ManualBarcodeComponent } from './manual-barcode/manual-barcode.component';
import { RecentScansComponent } from './recent-scans/recent-scans.component';
import { ScanResultComponent } from './scan-result/scan-result.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HttpClientModule,          
    ScanPageRoutingModule,      
  ],
  declarations: [ScanPage, ManualBarcodeComponent, RecentScansComponent, ScanResultComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ScanPageModule {}




