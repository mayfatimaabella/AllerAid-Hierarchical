


import { Injectable } from '@angular/core';
import { ModalController, AlertController, ToastController } from '@ionic/angular';
import { AddDoctorVisitModal } from '../ehr/modals/add-edit-doctor-visit/add-edit-doctor-visit.modal';
import { AddMedicalHistoryModal } from '../ehr/modals/add-edit-medical-history/add-edit-medical-history.modal';
import { EHRService } from '../../../core/services/ehr.service';

@Injectable({ providedIn: 'root' })
export class MedicalHistoryManagerService {

  async deleteDoctorVisit(
    visitId: string,
    doctorVisits: any[],
    loadMedicalData: () => Promise<void>
  ) {
    const visit = doctorVisits.find((v: any) => v.id === visitId);
    const visitName = visit ? `${visit.doctorName} visit on ${new Date(visit.visitDate).toLocaleDateString()}` : 'this doctor visit';

    const alert = await this.alertController.create({
      header: 'Delete Doctor Visit',
      message: `Are you sure you want to delete ${visitName}? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          cssClass: 'danger',
          handler: async () => {
            try {
              await this.ehrService.deleteDoctorVisit(visitId);
              await loadMedicalData();
              const toast = await this.toastController.create({
                message: 'Doctor visit deleted successfully',
                duration: 2000,
                color: 'success'
              });
              toast.present();
            } catch (error) {
              console.error('Error deleting doctor visit:', error);
              const toast = await this.toastController.create({
                message: 'Error deleting doctor visit',
                duration: 2000,
                color: 'danger'
              });
              toast.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }
  constructor(
    private modalController: ModalController,
    private alertController: AlertController,
    private toastController: ToastController,
    private ehrService: EHRService
  ) {}

  async revokeEHRAccess(
    providerEmail: string,
    ehrService: EHRService,
    loadMedicalData: () => Promise<void>,
    presentToast: (msg: string) => void
  ) {
    try {
      await ehrService.revokeEHRAccess(providerEmail);
      await loadMedicalData();
      presentToast('EHR access revoked successfully');
    } catch (error) {
      console.error('Error revoking EHR access:', error);
      presentToast('Error revoking EHR access');
    }
  }

  
  async openAddDoctorVisitModal(loadMedicalData: () => Promise<void>) {
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

  async openAddMedicalHistoryModal(loadMedicalData: () => Promise<void>) {
    const modal = await this.modalController.create({
      component: AddMedicalHistoryModal,
      componentProps: {}
    });
    modal.onDidDismiss().then((result) => {
      if (result.data) {
        loadMedicalData();
      }
    });
    await modal.present();
  }

  async editMedicalHistory(history: any, loadMedicalData: () => Promise<void>) {
    const modal = await this.modalController.create({
      component: AddMedicalHistoryModal,
      componentProps: {
        history: history,
        isEditMode: true
      }
    });
    modal.onDidDismiss().then((result) => {
      if (result.data) {
        loadMedicalData();
      }
    });
    await modal.present();
  }

  async deleteMedicalHistory(
    historyId: string,
    medicalHistory: any[],
    loadMedicalData: () => Promise<void>
  ) {
    const history = medicalHistory.find(h => h.id === historyId);
    const conditionName = history ? history.condition : 'this medical condition';
    const alert = await this.alertController.create({
      header: 'Delete Medical History',
      message: `Are you sure you want to delete ${conditionName}? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          cssClass: 'danger',
          handler: async () => {
            try {
              await this.ehrService.deleteMedicalHistory(historyId);
              await loadMedicalData();
              const toast = await this.toastController.create({
                message: 'Medical history deleted successfully',
                duration: 2000,
                color: 'success'
              });
              toast.present();
            } catch (error) {
              const toast = await this.toastController.create({
                message: 'Error deleting medical history',
                duration: 2000,
                color: 'danger'
              });
              toast.present();
            }
          }
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
  ) {
    try {
      // Validate required fields
      if (!newProviderEmail || !newProviderName) {
        presentToast('Please fill in provider email and name');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newProviderEmail)) {
        presentToast('Please enter a valid email address');
        return;
      }

      // TODO: Implement sendAccessRequest in EHRService
      // For now, show a success message
      presentToast('Access request feature coming soon!');
      // In the future, call EHRService here
    } catch (error: any) {
      console.error('Error sending access request:', error);
      presentToast(error.message || 'Error sending access request');
    }
  }
}
