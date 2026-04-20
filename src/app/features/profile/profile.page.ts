import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { combineLatest } from 'rxjs';

import {
  ToastController,
  ModalController
} from '@ionic/angular';

import { UserProfile } from '../../core/services/user.service';
import { EmergencyMessage } from '../../core/services/medical.service';
import { Medication } from '../../core/services/medication.service';

import { AllergyManagerService } from '../../core/services/allergy-manager.service';
import { VoiceRecordingService } from '../../core/services/voice-recording.service';

import { ProfileDataLoaderService } from './profile-services/profile-data-loader.service';
import { ProfileMedicationManagerService } from './profile-services/profile-medication-manager.service';
import { EmergencyInstructionsManagerService } from './profile-services/emergency-instructions-manager.service';
import { ProfileEHRManagerService } from './profile-services/profile-ehr-manager.service';
import { ProfileEmergencySettingsService } from './profile-services/profile-emergency-settings.service';
import { ProfileNavigationService } from './profile-services/profile-navigation.service';
import { ProfileUtilityService } from './profile-services/profile-utility.service';
import { ProfileAccessRequestService } from './profile-services/profile-access-request.service';
import { ProfileDataService } from './profile-services/profile-data.service';
import { VoiceSettingsManagerService } from './profile-services/voice-settings-manager.service';
import { AllergyModalService } from './profile-services/allergy-modal.service';

import { AddMedicationModal } from './health/modals/add-edit-medication/add-edit-medication.modal';
import { ChangePasswordModal } from './change-password/change-password.modal';
import {
  ActiveModal,
  Activity,
  Allergy,
  AllergyOption,
  DoctorStats,
  EmergencyInstructionItem,
  EmergencyMessageFormData,
  ProfessionalCredential,
  ProfessionalSettings,
} from './profile.types';

const EMPTY_EMERGENCY_MESSAGE: EmergencyMessage = {
  name: '',
  allergies: '',
  instructions: '',
  location: ''
};


@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit, OnDestroy {

  userAllergies: Allergy[] = [];

  activeModal: ActiveModal = null;
  allergyOptions: AllergyOption[] = [];
  allergiesCount: number = 0;
  readonly doctorStats: DoctorStats = {
    activePatients: 0,
    pendingRequests: 0,
    recentConsultations: 0,
    criticalPatients: 0,
    highRiskPatients: 0,
    upcomingAppointments: 0
  };
  readonly recentActivity: Activity[] = [];
  readonly professionalCredentials: ProfessionalCredential[] = [];
  readonly professionalSettings: ProfessionalSettings = {
    accessRequestNotifications: true,
    patientUpdateNotifications: true,
    emergencyAlerts: true,
    workingHours: '9:00 AM - 5:00 PM',
    contactPreference: 'Email'
  };

  public profileVoiceFacade!: VoiceSettingsManagerService;
  
  readonly vm$ = combineLatest({
    profile: this.profileDataLoader.userProfile$,
    allergies: this.profileDataLoader.userAllergies$,
    emergencyMessage: this.profileDataLoader.emergencyMessage$
  });

  // 2) Initialization
  async ngOnInit(): Promise<void> {
    
    this.profileVoiceFacade = this.voiceSettingsManager;

    await this.initializeProfile();
  }

  private async initializeProfile(): Promise<void> {
    await this.loadAllergyOptions();
    await this.profileDataLoader.loadAllData();

    this.userAllergies = this.profileDataLoader.userAllergiesValue;

    await Promise.all([
      this.loadMedicalData(),
      this.loadUserMedications(),
      this.loadEmergencyInstructions()
    ]);

    this.profileNavigation.setDefaultTabForRole(this.profileDataLoader.userProfileValue);
  }

  private async closeEmergencyModalIfOpen(): Promise<void> {
    if (this.activeModal !== 'emergencyInfo') return;

    this.activeModal = null;
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async openModal(component: any, cssClass?: string) {
    const modal = await this.modalController.create({ component, cssClass });
    await modal.present();
    return modal;
  }

  readonly loadMedicalDataFn = (): Promise<void> => this.loadMedicalData();
  readonly presentToastFn = (message: string): Promise<void> => this.presentToast(message);
  public readonly refreshAccessRequests = (): Promise<void> => this.profileAccessRequest.loadAccessRequests();
  
  // 3) Allergy Management
  // Open edit allergies modal
  async openEditAllergiesModal() {
    await this.closeEmergencyModalIfOpen();
    
    await this.refreshAllergiesDisplay();
    await this.allergyModalService.openEditAllergiesModal(
      this.allergyOptions,
      () => this.refreshAllergiesDisplay()
    );
  }
  
  async openAddMedicationModal() {
    const modal = await this.openModal(AddMedicationModal);
    modal.onDidDismiss().then((result) => {
      if (result.data?.saved) this.loadUserMedications();
    });
  }

  async openChangePasswordModal(): Promise<void> {
    await this.openModal(ChangePasswordModal, 'change-password-modal');
  }

  //Search medications with debounce
  searchMedications(event: any): void {
    this.profileMedicationManager.searchMedications(event);
  }

  /**
   * Clear medication search
   */
  clearMedicationSearch(): void {
    this.profileMedicationManager.clearMedicationSearch();
  }

    /**
   * Filter medications based on selected filter
   * Using memoization to improve performance
   */
  filterMedications(): void {
    this.profileMedicationManager.filterMedications();
  }

    /**
   * Toggle medication active status
   */
  async toggleMedicationStatus(medicationId: string | undefined): Promise<void> {
    await this.profileMedicationManager.toggleMedicationStatus(
      medicationId,
      () => this.loadUserMedications(),
      () => this.profileEHRManager.refreshEHRData()
    );
  }

    /**
   * Edit existing medication
   */
  async editMedication(medication: Medication): Promise<void> {
    await this.profileMedicationManager.editMedication(medication, () => this.loadUserMedications());
  }

  /**
   * Delete medication with confirmation
   */
  async deleteMedication(medicationId: string | undefined): Promise<void> {
    await this.profileMedicationManager.deleteMedication(
      medicationId,
      () => this.loadUserMedications(),
      () => this.profileMedicationManager.closeMedicationDetails()
    );
  } 

  openMedicationDetails(medication: Medication): void {
    this.profileMedicationManager.openMedicationDetails(medication, this);
  }

 openEditProfileModal = async (): Promise<void> => {
    await this.closeEmergencyModalIfOpen();

    //Adto profileEmergencySettings para i open modal
    //Dala emergency message (updated kay naay listener) or way sud
    //Dala user profile naa say listener
    await this.profileEmergencySettings.openEditProfileModal(
      this.profileDataLoader.emergencyMessageValue || EMPTY_EMERGENCY_MESSAGE,
      this.profileDataLoader.userProfileValue,
      (message: EmergencyMessageFormData) => this.saveEditedEmergencyMessage(message),
      () => this.refreshEmergencyMessageDisplay()
    );
  };

  /**
   * Refresh the emergency message-related UI after edits.
   * Reloads medical data (including the EmergencyMessage) and
   * ensures derived instruction entries reflect latest changes.
   */
  async refreshEmergencyMessageDisplay(): Promise<void> {
    await this.profileEmergencySettings.refreshEmergencyMessageDisplay(
      () => this.loadMedicalData(),
      () => this.loadEmergencyInstructions()
    );
  }

  async saveEditedEmergencyMessage(message: EmergencyMessageFormData): Promise<void> {
    await this.profileEmergencySettings.saveEditedEmergencyMessage(
      message,
      this.profileDataLoader.userProfileValue,
      (msg: EmergencyMessage) => { this.profileDataLoader.setEmergencyMessage(msg); },
      (profile: UserProfile) => { this.profileDataLoader.setUserProfile(profile); },
      () => this.loadMedicalData(),
      (toastMessage: string) => this.presentToast(toastMessage)
    );
  }

  getEmergencyInstructionEntries(): { label: string; text: string }[] {
    return this.profileEmergencySettings.getEmergencyInstructionEntries(
      this.emergencyInstructionsManager.emergencyInstructions,
      this.profileDataLoader.emergencyMessageValue ?? EMPTY_EMERGENCY_MESSAGE
    );
  }

  // Emergency settings save
  async loadAllergyOptions() {
    try {
      this.allergyOptions = await this.allergyManager.loadAllergyOptions();
    } catch (error) {
      console.error('Error loading allergy options:', error);
      this.allergyOptions = [];
      await this.presentToast('Unable to load allergy options. Please contact administrator.');
    }
  }

  async refreshAllergiesDisplay(): Promise<void> {
    const userProfile = this.profileDataLoader.userProfileValue;
    if (!userProfile) return;

    const allergies = await this.profileDataLoader.refreshAllergies(userProfile.uid);

    this.userAllergies = allergies;
    this.allergiesCount = allergies.length;
    this.updateAllergyOptions();
  }

  isEmergencyMedicationBind = this.profileMedicationManager.isEmergencyMedication.bind(this.profileMedicationManager);
  isExpiringSoonBind = this.profileMedicationManager.isExpiringSoon.bind(this.profileMedicationManager);
  

  constructor(
 public emergencyInstructionsManager: EmergencyInstructionsManagerService,
  public voiceSettingsManager: VoiceSettingsManagerService,
  public profileMedicationManager: ProfileMedicationManagerService,
  public profileEHRManager: ProfileEHRManagerService,
  public profileEmergencySettings: ProfileEmergencySettingsService,
  public profileNavigation: ProfileNavigationService,
  public profileUtility: ProfileUtilityService,
  public profileDataLoader: ProfileDataLoaderService,
  public profileDataService: ProfileDataService,
  public allergyManager: AllergyManagerService,
  public allergyModalService: AllergyModalService,
  public profileAccessRequest: ProfileAccessRequestService,
  public voiceRecordingService: VoiceRecordingService,

  public toastController: ToastController,
  public modalController: ModalController,
  public router: Router
  ) {}

    

    /**
     * Load medical profile and EHR data for the current user
     */
    async loadMedicalData(): Promise<void> {
      try {
        const data = await this.profileDataLoader.loadMedicalData();
        
        if (data.emergencyMessage) {
          this.profileDataLoader.setEmergencyMessage(data.emergencyMessage);
        }
        Object.assign(
          this.profileEmergencySettings.emergencySettings,
          data.emergencySettings || {}
        );

        this.profileEHRManager.doctorVisits = data.doctorVisits;
        this.profileEHRManager.medicalHistory = data.medicalHistory;
        this.profileEHRManager.ehrAccessList = data.ehrAccessList;
      } catch (error) {
        console.error('Error loading medical data:', error);
      }
    }

    /**
     * Update allergy options based on user's saved allergies
     */
    updateAllergyOptions(): void {
      this.allergyOptions.forEach(option => {
        const match = this.userAllergies.find(
          a => a.name === option.name && a.checked
        );

        option.checked = !!match;

        if (option.hasInput) {
          option.value = match?.value || '';
        }
      });
    }


  async loadEmergencyInstructions() {
    await this.emergencyInstructionsManager.loadEmergencyInstructions(this.profileDataLoader.userProfileValue);
  }

  async loadUserMedications(): Promise<void> {
    const user = this.profileDataLoader.userProfileValue;
    if (!user) return;
    await this.profileMedicationManager.loadUserMedications(user.uid);
  }

  async handleHealthRefresh(event: any): Promise<void> {
    try {
      await this.loadUserMedications();
      this.profileMedicationManager.filterMedications();
    } catch (error) {
      console.error('Error refreshing medications:', error);
      await this.presentToast('Error refreshing medications');
    } finally {
      if (event?.target && typeof event.target.complete === 'function') {
        event.target.complete();
      }
    }
  }
  
  private runEmergencyTest(type: 'alert' | 'shake' | 'power' | 'audio') {
    return this.profileEmergencySettings.runTest(type, (msg) => this.presentToast(msg));
}

  testEmergencyAlert = () => this.runEmergencyTest('alert');
  testShakeDetection = () => this.runEmergencyTest('shake');
  testPowerButtonDetection = () => this.runEmergencyTest('power');
  testAudioInstructions = () => this.runEmergencyTest('audio');

  async confirmDeleteInstruction(instruction?: EmergencyInstructionItem): Promise<void> {
    const id = instruction?.allergyId || instruction?.allergyName;
    if (!id) return;
    await this.emergencyInstructionsManager.onRemoveInstruction(id);
  }

  // Emergency instructions modal logic is now handled in EmergencyInstructionsModalComponent
    /**
     * Show a toast notification at the bottom of the screen
     */
    async presentToast(message: string): Promise<void> {
      const toast = await this.toastController.create({
        message,
        duration: 3000,
        position: 'bottom'
      });

      await toast.present();
    }

  ngOnDestroy(): void {
    window.speechSynthesis?.cancel();
  }


  async testInstructionAudio(instruction?: EmergencyInstructionItem): Promise<void> {
    if (!instruction) return;
    try {
      const text = instruction.instruction || 'No instruction content';
      await this.voiceRecordingService.playEmergencyInstructions(text);
      await this.presentToast('Instruction audio test played');
    } catch (e) {
      console.error('Error playing instruction audio', e);
      await this.presentToast('Audio test failed');
    }
  }

   openAddInstructionModal = async (): Promise<void> => {
    await this.closeEmergencyModalIfOpen();

    this.emergencyInstructionsManager.userAllergies = this.userAllergies;
    this.emergencyInstructionsManager.openManageInstructionsModal();
  };
  
  readonly openAddEmergencyMessageModal = (): void => {
    this.activeModal = 'emergencyMessage';
  };

  async saveNewEmergencyMessage(message: EmergencyMessageFormData): Promise<void> {
    await this.profileEmergencySettings.saveNewEmergencyMessage(
      message,
      this.profileDataLoader.userProfileValue,
      (toastMessage: string) => this.presentToast(toastMessage),
      () => this.loadMedicalData()
    );

    this.activeModal = null;
  }
}
