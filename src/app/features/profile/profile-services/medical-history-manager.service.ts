import { Injectable } from '@angular/core';
import { ModalController, AlertController, ToastController } from '@ionic/angular';
import { AddDoctorVisitModal } from '../ehr/modals/add-edit-doctor-visit/add-edit-doctor-visit.modal';
import { AddMedicalHistoryModal } from '../ehr/modals/add-edit-medical-history/add-edit-medical-history.modal';
import { EHRService } from '../../../core/services/ehr.service';
import { MedicalHistoryService } from '../../../core/services/medical-history.service';

@Injectable({ providedIn: 'root' })
export class MedicalHistoryManagerService {

  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController,
    private medicalHistoryService: MedicalHistoryService,
    private ehrService: EHRService
  ) {}

  /**
   * Show a uniform toast throughout the EHR section.
   */
  private async presentToast(
    message: string,
    color: 'success' | 'danger' | 'warning' | 'medium' = 'medium'
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });

    await toast.present();
  }

  async deleteDoctorVisit(
    visitId: string,
    doctorVisits: any[],
    loadMedicalData: () => Promise<void>
  ): Promise<void> {
    const visit = doctorVisits.find((v: any) => v.id === visitId);

    const visitName = visit
      ? `${visit.doctorName} visit on ${new Date(visit.visitDate).toLocaleDateString()}`
      : 'this doctor visit';

    const alert = await this.alertController.create({
      header: 'Delete Doctor Visit',
      message: `Are you sure you want to delete ${visitName}? This action cannot be undone.`,
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.ehrService.deleteDoctorVisit(visitId);
              await loadMedicalData();

              await this.presentToast(
                'Doctor visit deleted successfully',
                'success'
              );
            } catch (error) {
              console.error('Error deleting doctor visit:', error);

              await this.presentToast(
                'Error deleting doctor visit',
                'danger'
              );
            }
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  async revokeEHRAccess(
    providerEmail: string,
    ehrService: EHRService,
    loadMedicalData: () => Promise<void>,
    presentToast: (msg: string) => void
  ): Promise<void> {
    try {
      await ehrService.revokeEHRAccess(providerEmail);
      await loadMedicalData();

      await this.presentToast(
        'EHR access revoked successfully',
        'success'
      );
    } catch (error) {
      console.error('Error revoking EHR access:', error);

      await this.presentToast(
        'Error revoking EHR access',
        'danger'
      );
    }
  }

  async openAddDoctorVisitModal(
    loadMedicalData: () => Promise<void>
  ): Promise<void> {
    const modal = await this.modalController.create({
      component: AddDoctorVisitModal,
      cssClass: 'fullscreen-modal'
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        await loadMedicalData();
      }
    });

    await modal.present();
  }

  async openAddMedicalHistoryModal(
    loadMedicalData: () => Promise<void>
  ): Promise<void> {
    const modal = await this.modalController.create({
      component: AddMedicalHistoryModal,
      componentProps: {}
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        await loadMedicalData();
      }
    });

    await modal.present();
  }

  async editMedicalHistory(
    history: any,
    loadMedicalData: () => Promise<void>
  ): Promise<void> {
    const modal = await this.modalController.create({
      component: AddMedicalHistoryModal,
      componentProps: {
        history,
        isEditMode: true
      }
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data) {
        await loadMedicalData();
      }
    });

    await modal.present();
  }

  async deleteMedicalHistory(
    historyId: string,
    medicalHistory: any[],
    loadMedicalData: () => Promise<void>
  ): Promise<void> {
    const history = medicalHistory.find(h => h.id === historyId);

    const conditionName = history
      ? history.condition
      : 'this medical condition';

    const alert = await this.alertController.create({
      header: 'Delete Medical History',
      message: `Are you sure you want to delete ${conditionName}? This action cannot be undone.`,
      buttons: [
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.medicalHistoryService.deleteMedicalHistory(historyId);
              await loadMedicalData();

              await this.presentToast(
                'Medical history deleted successfully',
                'success'
              );
            } catch (error) {
              console.error('Error deleting medical history:', error);

              await this.presentToast(
                'Error deleting medical history',
                'danger'
              );
            }
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  async sendAccessRequest(
    newProviderEmail: string,
    newProviderName: string,
    newProviderRole: string,
    newProviderLicense: string,
    newProviderSpecialty: string,
    newProviderHospital: string,
    presentToast: (msg: string) => void
  ): Promise<void> {
    try {
      if (!newProviderEmail || !newProviderName) {
        await this.presentToast(
          'Please fill in provider email and name',
          'warning'
        );
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(newProviderEmail)) {
        await this.presentToast(
          'Please enter a valid email address',
          'warning'
        );
        return;
      }

      // TODO: Implement sendAccessRequest in EHRService

      await this.presentToast(
        'Access request feature coming soon!',
        'medium'
      );

    } catch (error: any) {
      console.error('Error sending access request:', error);

      await this.presentToast(
        error.message || 'Error sending access request',
        'danger'
      );
    }
  }
}
