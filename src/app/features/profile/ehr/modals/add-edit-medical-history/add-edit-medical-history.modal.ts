import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import {
  MedicalHistory,
  MedicalHistoryService
} from '../../../../../core/services/medical-history.service';

@Component({
  selector: 'app-add-medical-history',
  templateUrl: './add-edit-medical-history.modal.html',
  styleUrls: ['./add-edit-medical-history.modal.scss'],
  standalone: false,
})
export class AddMedicalHistoryModal implements OnInit {
  @Input() history?: MedicalHistory;

  currentDate: string = new Date().toISOString();

  historyData: Omit<MedicalHistory, 'id' | 'patientId'> = {
    condition: '',
    diagnosisDate: new Date().toISOString(),
    status: 'active',
    notes: ''
  };

  isEditMode = false;
  isSaving = false;

  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'not-cured', label: 'Not Cured' },
    { value: 'chronic', label: 'Chronic' }
  ];

  commonConditions = [
    'Diabetes',
    'Hypertension',
    'Asthma',
    'Allergies',
    'Depression',
    'Anxiety',
    'High Cholesterol',
    'Arthritis',
    'COPD',
    'Heart Disease',
    'Migraines',
    'Thyroid Disorder',
    'Gastroesophageal Reflux Disease (GERD)',
    'Sleep Apnea',
    'Osteoporosis'
  ];

  constructor(
    private modalController: ModalController,
    private toastController: ToastController,
    private medicalHistoryService: MedicalHistoryService
  ) {}

  ngOnInit(): void {
    if (this.history) {
      this.isEditMode = true;

      const diagnosisDate = this.normalizeDate(
        this.history.diagnosisDate
      );

      this.historyData = {
        condition: this.history.condition || '',
        diagnosisDate:
          diagnosisDate || new Date().toISOString(),
        status: this.history.status || 'active',
        notes: this.history.notes || ''
      };

      console.log(
        'Edit mode - Pre-filling form with:',
        this.historyData
      );
    }
  }

  /**
   * Converts different possible date formats into
   * the ISO format expected by ion-datetime.
   */
  private normalizeDate(dateValue: any): string {
    if (!dateValue) {
      return '';
    }

    // Already a Date object
    if (dateValue instanceof Date) {
      return dateValue.toISOString();
    }

    // Firestore Timestamp
    if (
      typeof dateValue === 'object' &&
      typeof dateValue.toDate === 'function'
    ) {
      return dateValue.toDate().toISOString();
    }

    // Firestore Timestamp with seconds
    if (
      typeof dateValue === 'object' &&
      dateValue.seconds
    ) {
      return new Date(
        dateValue.seconds * 1000
      ).toISOString();
    }

    // String / number
    const parsedDate = new Date(dateValue);

    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString();
    }

    return '';
  }

  selectCondition(condition: string): void {
    this.historyData.condition = condition;
  }

  /**
   * Saves either a new medical history record
   * or updates an existing one.
   */
  async saveHistory(): Promise<void> {
    // Prevent double submission
    if (this.isSaving) {
      return;
    }

    // Validate medical condition
    if (!this.historyData.condition.trim()) {
      await this.presentToast(
        'Please enter a medical condition'
      );
      return;
    }

    // Validate diagnosis date
    if (!this.historyData.diagnosisDate) {
      await this.presentToast(
        'Please select diagnosis date'
      );
      return;
    }

    this.isSaving = true;

    try {

      // ================================
      // EDIT EXISTING MEDICAL HISTORY
      // ================================

      if (this.isEditMode && this.history?.id) {

        await this.medicalHistoryService.updateMedicalHistory(
          this.history.id,
          this.historyData
        );

        await this.presentToast(
          'Medical history updated successfully'
        );

        await this.modalController.dismiss({
          saved: true
        });

        return;
      }


      // ================================
      // ADD NEW MEDICAL HISTORY
      // ================================

      await this.medicalHistoryService.addMedicalHistory(
        this.historyData
      );

      await this.presentToast(
        'Medical history added successfully'
      );

      await this.modalController.dismiss({
        saved: true
      });

    } catch (error) {

      console.error(
        'Error saving medical history:',
        error
      );

      let errorMessage =
        'Error saving medical history';

      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }

      await this.presentToast(errorMessage);

    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Deletes the existing medical history record.
   */
  async deleteHistory(): Promise<void> {
    if (this.isSaving) {
      return;
    }

    if (!this.history?.id) {
      return;
    }

    this.isSaving = true;

    try {

      await this.medicalHistoryService.deleteMedicalHistory(
        this.history.id
      );

      await this.presentToast(
        'Medical history deleted successfully'
      );

      await this.modalController.dismiss({
        deleted: true
      });

    } catch (error) {

      console.error(
        'Error deleting medical history:',
        error
      );

      let errorMessage =
        'Error deleting medical history';

      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }

      await this.presentToast(errorMessage);

    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    if (this.isSaving) {
      return;
    }

    this.modalController.dismiss();
  }

  private async presentToast(
    message: string
  ): Promise<void> {

    const toast =
      await this.toastController.create({
        message,
        duration: 2000,
        position: 'bottom'
      });

    await toast.present();
  }
}
