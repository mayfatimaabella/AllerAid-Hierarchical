import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { BuddyPageRoutingModule } from './buddy-routing.module';

import { BuddyPage } from './pages/buddy.page';
import { 
  BuddyActionsModalComponent,
  BuddyEditModalComponent,
  BuddyDeleteConfirmModalComponent,
  BuddyDetailsModalComponent
} from './components';
import { BuddyInvitationsModal } from './components/buddy-invitations-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    BuddyPageRoutingModule,
    BuddyDetailsModalComponent
  ],
  declarations: [
    BuddyPage,
    BuddyActionsModalComponent,
    BuddyEditModalComponent,
    BuddyDeleteConfirmModalComponent,
    BuddyInvitationsModal
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class BuddyPageModule {}




