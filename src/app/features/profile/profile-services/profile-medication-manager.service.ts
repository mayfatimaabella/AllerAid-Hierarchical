import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MedicationService, Medication } from '../../../core/services/medication.service';
import { MedicationReminderService } from '../../../core/services/medication-reminder.service';
import { MedicationManagerService } from './medication-manager.service';
import { MedicationActionsService } from './medication-actions.service';
import { AlertController, ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ProfileMedicationManagerService {
  // State properties
  userMedications: Medication[] = [];
  filteredMedications: Medication[] = [];
  medicationFilter: string = 'all';
  medicationSearchTerm: string = '';
  isLoadingMedications: boolean = false;
  medicationsCount: number = 0;

  // Observable properties for template binding with async pipe
  private userMedicationsSubject = new BehaviorSubject<Medication[]>([]);
  userMedications$ = this.userMedicationsSubject.asObservable();

  private filteredMedicationsSubject = new BehaviorSubject<Medication[]>([]);
  filteredMedications$ = this.filteredMedicationsSubject.asObservable();

  private isLoadingMedicationsSubject = new BehaviorSubject<boolean>(false);
  isLoadingMedications$ = this.isLoadingMedicationsSubject.asObservable();

  medicationFilterCache = new Map<string, Medication[]>();
  expandedMedicationIds: Set<string> = new Set();
  showMedicationDetailsModal: boolean = false;
  selectedMedication: any = null;

  private searchTimeout: any;

  constructor(
    private medicationService: MedicationService,
    private medicationManager: MedicationManagerService,
    private medicationActionsService: MedicationActionsService,
    private reminders: MedicationReminderService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  /**
   * Load medications for a user
   */
  async loadUserMedications(uid: string, onComplete?: () => void): Promise<void> {
    try {
      this.isLoadingMedications = true;
      this.isLoadingMedicationsSubject.next(true);
      this.userMedications = await this.medicationService.getUserMedications(uid);
      this.medicationsCount = this.userMedications.length;
      this.clearMedicationCache();
      this.filterMedications();
      this.userMedicationsSubject.next(this.userMedications);
      
      // Reschedule notifications based on current meds & intervals
      try {
        await this.reminders.rescheduleAll(this.userMedications as any[]);
      } catch (e) {
        console.warn('Reminder scheduling skipped or failed:', e);
      }
      
      this.isLoadingMedications = false;
      this.isLoadingMedicationsSubject.next(false);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error loading medications:', error);
      this.isLoadingMedications = false;
      this.isLoadingMedicationsSubject.next(false);
    }
  }

  /**
   * Search medications with debounce
   */
  searchMedications(event: any): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = setTimeout(() => {
      this.medicationSearchTerm = event.detail.value || event.target.value || '';
      this.clearMedicationCache();
      this.filterMedications();
    }, 300);
  }

  /**
   * Clear medication search
   */
  clearMedicationSearch(): void {
    this.medicationSearchTerm = '';
    this.clearMedicationCache();
    this.filterMedications();
  }

  /**
   * Filter medications based on selected filter
   * Using memoization to improve performance
   */
  filterMedications(): void {
    this.medicationManager.filterMedications(
      this.userMedications,
      this.medicationFilter,
      this.medicationSearchTerm,
      this.medicationFilterCache,
      (result: any[]) => {
        this.filteredMedications = result;
        this.filteredMedicationsSubject.next(result);
      }
    );
  }

  /**
   * Toggle medication details expansion
   */
  toggleMedicationDetails(id: string): void {
    this.medicationManager.toggleDetails(id, this.expandedMedicationIds);
  }

  /**
   * Check if medication details are expanded
   */
  isMedicationDetailsExpanded(id: string): boolean {
    return this.expandedMedicationIds.has(id);
  }

  /**
   * Toggle medication active status
   */
  async toggleMedicationStatus(
    medicationId: string | undefined,
    onLoadComplete: () => Promise<void>,
    onRefreshEHR: () => Promise<void>
  ): Promise<void> {
    await this.medicationManager.toggleMedicationStatus(
      medicationId,
      onLoadComplete,
      this.userMedications,
      this.reminders,
      onRefreshEHR,
      this.presentToast.bind(this)
    );
  }

  /**
   * Edit existing medication
   */
  async editMedication(medication: Medication, onComplete: () => Promise<void>): Promise<void> {
    await this.medicationManager.editMedication(medication, onComplete);
  }

  /**
   * Delete medication with confirmation
   */
  async deleteMedication(
    medicationId: string | undefined,
    onLoadComplete: () => Promise<void>,
    onDeleted?: () => void
  ): Promise<void> {
    await this.medicationManager.deleteMedication(
      medicationId,
      this.userMedications,
      onLoadComplete,
      this.reminders,
      this.presentToast.bind(this),
      this.alertController,
      onDeleted
    );
  }

  /**
   * View medication image in modal
   */
  viewMedicationImage(url: string, title: string): void {
    this.medicationActionsService.viewMedicationImage(url, title);
  }

  /**
   * Open medication details modal
   */
  openMedicationDetails(medication: any, pageContext: any): void {
    this.medicationActionsService.openMedicationDetails(medication, pageContext);
  }

  /**
   * Close medication details modal
   */
  closeMedicationDetails(): void {
    this.showMedicationDetailsModal = false;
    this.selectedMedication = null;
  }

  /**
   * Clear medication filter cache when medications change
   */
  private clearMedicationCache(): void {
    this.medicationFilterCache.clear();
    this.expandedMedicationIds.clear();
  }

  /**
   * Check if a medication is marked as emergency
   */
  isEmergencyMedication(medication: Medication): boolean {
    return medication.category === 'emergency';
  }

  /**
   * Check if a medication is expiring soon (within 7 days)
   * Can accept either a Medication object or a date string
   */
  isExpiringSoon(medicationOrDate: Medication | string | undefined): boolean {
    let expiryDateStr: string | undefined;

    if (typeof medicationOrDate === 'string') {
      expiryDateStr = medicationOrDate;
    } else if (medicationOrDate && typeof medicationOrDate === 'object') {
      expiryDateStr = (medicationOrDate as Medication).expiryDate;
    }

    if (!expiryDateStr) {
      return false;
    }

    try {
      const expiryDate = new Date(expiryDateStr);
      const today = new Date();
      const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      return expiryDate <= sevenDaysFromNow && expiryDate > today;
    } catch {
      return false;
    }
  }

  /**
   * Show a toast notification
   */
  private async presentToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
