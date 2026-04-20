import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { EHRService, DoctorVisit, MedicalHistory } from '../../../core/services/ehr.service';
import { EHRDataService } from './ehr-data.service';
import { MedicalHistoryManagerService } from './medical-history-manager.service';
import { ModalController, AlertController, ActionSheetController, ToastController } from '@ionic/angular';
import { AddDoctorVisitModal } from '../ehr/modals/add-edit-doctor-visit/add-edit-doctor-visit.modal';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProfileEHRManagerService {
  // State properties
  doctorVisits: any[] = [];
  medicalHistory: any[] = [];
  ehrAccessList: any[] = [];
  healthcareProviders: any[] = [];
  isLoadingDoctorVisits: boolean = false;
  isLoadingMedicalHistory: boolean = false;
  isDoctorVisitsExpanded: boolean = false;
  isMedicalHistoryExpanded: boolean = false;
  isLoadingEHR: boolean = false;

  // Form properties
  newProviderEmail: string = '';
  newProviderName: string = '';
  newProviderRole: 'doctor' | 'nurse' = 'doctor';
  newProviderLicense: string = '';
  newProviderSpecialty: string = '';
  newProviderHospital: string = '';

  constructor(
    private router: Router,
    private ehrService: EHRService,
    private ehrDataService: EHRDataService,
    private medicalHistoryManager: MedicalHistoryManagerService,
    private modalController: ModalController,
    private alertController: AlertController,
    private actionSheetController: ActionSheetController,
    private toastController: ToastController
  ) {}

  /**
   * Refresh EHR-related data after medication changes
   */
  async refreshEHRData(): Promise<void> {
    const ehrData = await this.ehrDataService.loadEHRData();
    this.medicalHistory = ehrData.medicalHistory;
    this.ehrAccessList = ehrData.ehrAccessList;
    this.healthcareProviders = ehrData.healthcareProviders;
    this.isLoadingMedicalHistory = false;
    
    if (!environment.production) {
      console.log('Loaded EHR data (ProfileEHRManager):');
      console.log('- Doctor visits:', this.doctorVisits.length, this.doctorVisits);
      console.log('- Medical history:', this.medicalHistory.length, this.medicalHistory);
      console.log('- EHR access list:', this.ehrAccessList.length);
      console.log('- Healthcare providers:', this.healthcareProviders.length);
    }
  }

  /**
   * Open add doctor visit modal
   */
  async openAddDoctorVisitModal(onComplete: () => Promise<void>): Promise<void> {
    await this.medicalHistoryManager.openAddDoctorVisitModal(onComplete);
  }

  /**
   * Open add medical history modal
   */
  async openAddMedicalHistoryModal(onComplete: () => Promise<void>): Promise<void> {
    await this.medicalHistoryManager.openAddMedicalHistoryModal(onComplete);
  }

  /**
   * Send access request to a healthcare provider
   */
  async sendAccessRequest(presentToast: (msg: string) => Promise<void>): Promise<void> {
    await this.medicalHistoryManager.sendAccessRequest(
      this.newProviderEmail,
      this.newProviderName,
      this.newProviderRole,
      this.newProviderLicense,
      this.newProviderSpecialty,
      this.newProviderHospital,
      presentToast
    );

    // Clear the form after sending
    this.newProviderEmail = '';
    this.newProviderName = '';
    this.newProviderRole = 'doctor';
    this.newProviderLicense = '';
    this.newProviderSpecialty = '';
    this.newProviderHospital = '';
  }

  /**
   * Revoke EHR access for a provider
   */
  revokeEHRAccess(event: any, onLoadComplete: () => Promise<void>, presentToast: (msg: string) => Promise<void>): void {
    if (event && event.provider) {
      this.medicalHistoryManager.revokeEHRAccess(
        event.provider,
        this.ehrService,
        onLoadComplete,
        presentToast
      );
    }
  }

  /**
   * Open visit details page
   */
  openVisitDetails(event: any): void {
    if (event && event.doctorVisit && event.doctorVisit.id) {
      this.router.navigate(['/visit-details', event.doctorVisit.id]);
    }
  }

  /**
   * Open edit doctor visit modal
   */
  async openEditDoctorVisitModal(visitOrEvent: any): Promise<void> {
    const visit: DoctorVisit | undefined = (visitOrEvent && visitOrEvent.doctorVisit) 
      ? visitOrEvent.doctorVisit 
      : visitOrEvent;
      
    const modal = await this.modalController.create({
      component: AddDoctorVisitModal,
      componentProps: { visit },
      cssClass: 'force-white-modal',
      breakpoints: [0, 1],
      initialBreakpoint: 1
    });
    await modal.present();
  }

  /**
   * Delete doctor visit
   */
  async deleteDoctorVisit(visitId: string, onLoadComplete: () => Promise<void>): Promise<void> {
    await this.medicalHistoryManager.deleteDoctorVisit(
      visitId,
      this.doctorVisits,
      onLoadComplete
    );
  }

  /**
   * Open medical history details
   */
  openMedicalHistoryDetails(event: any): void {
    if (event && event.medicalHistory) {
      this.viewMedicalHistoryDetails(event.medicalHistory);
    }
  }

  /**
   * Present visit actions popover
   */
  async presentVisitActionsPopover(event: any): Promise<void> {
    if (event && event.event && event.visit) {
      const visit: DoctorVisit = event.visit;
      const header = visit.doctorName ? `Dr. ${visit.doctorName}` : 'Doctor Visit';
      const actionSheet = await this.actionSheetController.create({
        header,
        buttons: [
          {
            text: 'Edit Visit',
            icon: 'create-outline',
            handler: () => this.openEditDoctorVisitModal(visit)
          },
          {
            text: 'Delete Visit',
            role: 'destructive',
            icon: 'trash-outline',
            handler: async () => {
              const id = visit.id ?? '';
              if (!id) return;
              
              const confirm = await this.alertController.create({
                header: 'Delete Visit',
                message: 'Are you sure you want to delete this visit?',
                buttons: [
                  { text: 'Cancel', role: 'cancel' },
                  { 
                    text: 'Delete', 
                    role: 'destructive', 
                    handler: () => this.deleteDoctorVisit(id, async () => {})
                  }
                ]
              });
              await confirm.present();
            }
          },
          { text: 'Cancel', role: 'cancel', icon: 'close-outline' }
        ]
      });
      await actionSheet.present();
    }
  }

  /**
   * Present history actions popover
   */
  async presentHistoryActionsPopover(event: any, onLoadComplete: () => Promise<void>): Promise<void> {
    if (event && event.event && event.history) {
      await this._presentHistoryActionsPopover(event.event, event.history, onLoadComplete);
    }
  }

  /**
   * Private helper for presenting history actions popover
   */
  private async _presentHistoryActionsPopover(
    eventObj: any, 
    history: MedicalHistory, 
    onLoadComplete: () => Promise<void>
  ): Promise<void> {
    const header = history?.condition ? history.condition : 'Medical History';
    const actionSheet = await this.actionSheetController.create({
      header,
      buttons: [
        {
          text: 'Edit History',
          icon: 'create-outline',
          handler: () => this.editMedicalHistory(history, onLoadComplete)
        },
        {
          text: 'Delete History',
          role: 'destructive',
          icon: 'trash-outline',
          handler: async () => {
            const id = history.id ?? '';
            if (!id) return;
            
            const confirm = await this.alertController.create({
              header: 'Delete History',
              message: 'Are you sure you want to delete this history?',
              buttons: [
                { text: 'Cancel', role: 'cancel' },
                { 
                  text: 'Delete', 
                  role: 'destructive', 
                  handler: () => this.deleteMedicalHistory(id, onLoadComplete)
                }
              ]
            });
            await confirm.present();
          }
        },
        { text: 'Cancel', role: 'cancel', icon: 'close-outline' }
      ]
    });
    await actionSheet.present();
  }

  /**
   * Edit medical history
   */
  async editMedicalHistory(history: MedicalHistory, onComplete: () => Promise<void>): Promise<void> {
    await this.medicalHistoryManager.editMedicalHistory(history, onComplete);
  }

  /**
   * Delete medical history
   */
  async deleteMedicalHistory(historyId: string, onComplete: () => Promise<void>): Promise<void> {
    await this.medicalHistoryManager.deleteMedicalHistory(
      historyId,
      this.medicalHistory,
      onComplete
    );
  }

  /**
   * View details of a medical history condition
   */
  async viewMedicalHistoryDetails(condition: MedicalHistory): Promise<void> {
    const alert = await this.alertController.create({
      header: condition.condition,
      message: `
        <div style="text-align: left;">
          <p><strong>Diagnosed:</strong> ${new Date(condition.diagnosisDate).toLocaleDateString()}</p>
          ${condition.status ? `<p><strong>Status:</strong> ${condition.status}</p>` : ''}
          ${condition.notes ? `<p><strong>Notes:</strong> ${condition.notes}</p>` : ''}
        </div>
      `,
      buttons: ['Close']
    });

    await alert.present();
  }

  /**
   * Grant EHR access to a provider
   */
  async grantEHRAccess(onLoadComplete: () => Promise<void>, presentToast: (msg: string) => Promise<void>): Promise<void> {
    if (!this.newProviderEmail || !this.newProviderEmail.trim()) {
      await presentToast('Please enter provider email');
      return;
    }

    try {
      await this.ehrService.grantEHRAccess(this.newProviderEmail.trim());
      await onLoadComplete();
      this.newProviderEmail = '';
      await presentToast('EHR access granted successfully');
    } catch (error) {
      console.error('Error granting EHR access:', error);
      await presentToast('Error granting EHR access');
    }
  }

  /**
   * Grant enhanced healthcare provider access with role
   */
  async grantHealthcareProviderAccess(
    onLoadComplete: () => Promise<void>, 
    presentToast: (msg: string) => Promise<void>
  ): Promise<void> {
    if (!this.newProviderEmail?.trim() || !this.newProviderName?.trim()) {
      await presentToast('Please enter provider email and name');
      return;
    }

    try {
      await this.ehrService.grantHealthcareProviderAccess(
        this.newProviderEmail.trim(),
        this.newProviderRole,
        this.newProviderName.trim(),
        this.newProviderLicense?.trim(),
        this.newProviderSpecialty?.trim(),
        this.newProviderHospital?.trim()
      );
      
      await onLoadComplete();
      
      // Clear the form
      this.newProviderEmail = '';
      this.newProviderName = '';
      this.newProviderRole = 'doctor';
      this.newProviderLicense = '';
      this.newProviderSpecialty = '';
      this.newProviderHospital = '';
      
      await presentToast('Access request sent to healthcare provider. They must accept before gaining access.');
    } catch (error) {
      console.error('Error sending access request:', error);
      if (error instanceof Error) {
        await presentToast(`Error: ${error.message}`);
      } else {
        await presentToast('Error sending access request to healthcare provider');
      }
    }
  }

  /**
   * Revoke healthcare provider access
   */
  async revokeHealthcareProviderAccess(
    providerEmail: string, 
    onLoadComplete: () => Promise<void>, 
    presentToast: (msg: string) => Promise<void>
  ): Promise<void> {
    try {
      await this.ehrService.revokeHealthcareProviderAccess(providerEmail);
      await onLoadComplete();
      await presentToast('Healthcare provider access revoked successfully');
    } catch (error) {
      console.error('Error revoking healthcare provider access:', error);
      await presentToast('Error revoking healthcare provider access');
    }
  }

  /**
   * Get role display name
   */
  getRoleDisplayName(role: 'doctor'): string {
    return 'Doctor';
  }
}
