import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { EHRService, MedicalHistory } from '../../../../../core/services/ehr.service';

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
    private ehrService: EHRService
  ) {}

  ngOnInit() {
    if (this.history) {
      this.isEditMode = true;
      
      // Ensure proper date formatting for the datetime component
      let diagnosisDate = this.history.diagnosisDate;
      if (diagnosisDate && typeof diagnosisDate === 'string') {
        // If it's already a string, ensure it's in ISO format
        diagnosisDate = new Date(diagnosisDate).toISOString();
      } else if (diagnosisDate && typeof diagnosisDate === 'object') {
        // Handle Firestore timestamp objects
        const timestampObj = diagnosisDate as any;
        if (timestampObj.seconds) {
          diagnosisDate = new Date(timestampObj.seconds * 1000).toISOString();
        } else if (timestampObj.toDate && typeof timestampObj.toDate === 'function') {
          diagnosisDate = timestampObj.toDate().toISOString();
        }
      }
      
      this.historyData = {
        condition: this.history.condition || '',
        diagnosisDate: diagnosisDate || new Date().toISOString(),
        status: this.history.status || 'active',
        notes: this.history.notes || ''
      };
      
      console.log('Edit mode - Pre-filling form with:', this.historyData);
    }
  }

  selectCondition(condition: string) {
    this.historyData.condition = condition;
  }

  async saveHistory() {
    try {
      if (!this.historyData.condition.trim()) {
        await this.showToast('Please enter a medical condition', 'warning');
        return;
      }

      if (this.isEditMode && this.history?.id) {
        await this.ehrService.updateMedicalHistory(this.history.id, this.historyData);
        await this.showToast('Medical history updated successfully', 'success');
      } else {
        await this.ehrService.addMedicalHistory(this.historyData);
        await this.showToast('Medical history added successfully', 'success');
      }

      this.modalController.dismiss(true);
    } catch (error) {
      console.error('Error saving medical history:', error);
      await this.showToast('Error saving medical history', 'danger');
    }
  }

  async deleteHistory() {
    if (this.history?.id) {
      try {
        await this.ehrService.deleteMedicalHistory(this.history.id);
        await this.showToast('Medical history deleted successfully', 'success');
        this.modalController.dismiss(true);
      } catch (error) {
        console.error('Error deleting medical history:', error);
        await this.showToast('Error deleting medical history', 'danger');
      }
    }
  }

  cancel() {
    this.modalController.dismiss();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
