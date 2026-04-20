import { NgModule, CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProfilePageRoutingModule } from './profile-routing.module';

import { ProfilePage } from './profile.page';
import { EHRSectionCardsComponent } from './ehr/ehr-section-cards.component';
import { AddMedicationModal } from './health/modals/add-edit-medication/add-edit-medication.modal';
import { AddDoctorVisitModal } from './ehr/modals/add-edit-doctor-visit/add-edit-doctor-visit.modal';
import { AddMedicalHistoryModal } from './ehr/modals/add-edit-medical-history/add-edit-medical-history.modal';
import { DoctorProfileComponent } from './components-doctor-profile/doctor-profile.component';
import { EmergencyDetailsModalComponent } from './overview/modals/emergency-details-modal/emergency-details-modal.component';
import { EmergencySpecificInstructionsModalComponent } from './overview/modals/emergency-specific-instructions-modal/emergency-specific-instructions-modal.component';
import { ImageViewerModal } from './change-password/image-viewer.modal';
import { OverviewSectionComponent } from './overview/overview-section.component';
import { HealthSectionComponent } from './health/health-section.component';
import { MedicationDetailsModal } from './health/modals/medication-details/medication-details.modal';
import { EmergencySettingsCardComponent } from './emergency/emergency-settings-card.component';
import { EditEmergencyProfileModalComponent } from './overview/modals/edit-profile-message/edit-emergency-profile-modal.component';
import { ChangePasswordModal } from './change-password/change-password.modal';
import { ProfileSettingsComponent } from './emergency/voice-settings-section/profile-settings.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProfilePageRoutingModule,
    DoctorProfileComponent,  
    EmergencyDetailsModalComponent,  
    OverviewSectionComponent,
    HealthSectionComponent,
    MedicationDetailsModal,
    EHRSectionCardsComponent,
    EmergencySettingsCardComponent,
    ProfileSettingsComponent,
    EmergencySpecificInstructionsModalComponent,
    EditEmergencyProfileModalComponent
  ],


  declarations: [
    ProfilePage,
    AddMedicationModal,
    AddDoctorVisitModal,
    AddMedicalHistoryModal,
    ImageViewerModal,
    ChangePasswordModal
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
})
export class ProfilePageModule {}
