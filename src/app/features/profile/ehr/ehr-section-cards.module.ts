
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EhrAccessManagementCardComponent } from './access-management/ehr-access-management-card.component';


@NgModule({
  declarations: [EhrAccessManagementCardComponent],
  imports: [CommonModule],
  exports: [EhrAccessManagementCardComponent]
})
export class EHRSectionCardsModule {}
