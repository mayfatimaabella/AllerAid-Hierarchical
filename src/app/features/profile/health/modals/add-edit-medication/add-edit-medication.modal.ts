import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController, ActionSheetController } from '@ionic/angular';
import { MedicationService, Medication } from '../../../../../core/services/medication.service';

@Component({
  selector: 'app-add-medication',
  templateUrl: './add-edit-medication.modal.html',
  styleUrls: ['./add-edit-medication.modal.scss'],
  standalone: false,
})
export class AddMedicationModal implements OnInit {
  medication?: Medication; // Passed as componentProp when opening the modal for editing
  isEditMode: boolean = false;

  // Initializing with default values for new entries
  // Properties like pillsPerDose and durationDays are used for auto-calculations
  med: Medication = {
    name: '',
    dosage: '',
    frequency: '',
    quantity: 0,
    startDate: new Date().toISOString(),
    notes: '',
    category: 'other',
    isActive: true,
    // Calculation helper properties
    pillsPerDose: 0,
    intervalHours: 0,
    durationDays: 0,
    dosageUnit: ''
  };

  prescriptionImage: string | null = null;
  todayISO: string = new Date().toISOString();

  constructor(
    private modalCtrl: ModalController,
    private medService: MedicationService,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController
  ) {}

  ngOnInit() {
    if (this.isEditMode && this.medication) {
      // Clone existing medication data into the local form object
      this.med = { ...this.medication };

      // Ensure the startDate is in a valid ISO format for the ion-datetime picker
      if (this.med.startDate && typeof this.med.startDate === 'string') {
        this.med.startDate = new Date(this.med.startDate).toISOString();
      }

      // Load existing image URL if available
      if (this.medication.prescriptionImageUrl) {
        this.prescriptionImage = this.medication.prescriptionImageUrl;
      }

      // Run initial calculation logic to sync the UI with existing data
      this.onDateOrIntervalChange();
    } else {
      // Default setup for new medications
      this.med.startDate = this.todayISO;
      this.onDateOrIntervalChange();
    }
  }

  /**
   * Closes the modal without saving
   */
  dismiss() {
    this.modalCtrl.dismiss();
  }

  /**
   * Main calculation logic: Triggered by changes to Start Date, Interval, or Duration.
   * Updates the 'expiryDate', 'quantity', and 'frequency' label automatically.
   */
  onDateOrIntervalChange() {
    if (this.med.startDate && this.med.durationDays) {
      const start = new Date(this.med.startDate);
      const days = parseInt(this.med.durationDays.toString(), 10);

      // 1. Calculate Projected End Date (Start Date + Duration)
      const end = new Date(start);
      end.setDate(start.getDate() + days);
      this.med.expiryDate = end.toISOString();

      // 2. Calculate Total Pills Required
      this.calculateTotalPills();

      // 3. Update Frequency description label for display in lists
      const label = this.getIntervalLabel(this.med.intervalHours || 24);
      this.med.frequency = `${days} days (${label})`;
    }
  }

  /**
   * Logic to determine total pill quantity based on schedule
   */
  private calculateTotalPills() {
    if (this.med.intervalHours && this.med.durationDays && this.med.pillsPerDose) {
      const dosesPerDay = 24 / this.med.intervalHours;
      const totalDoses = dosesPerDay * this.med.durationDays;
      // Math.ceil ensures we don't under-calculate for partial/irregular schedules
      this.med.quantity = Math.ceil(totalDoses * this.med.pillsPerDose);
    }
  }

  /**
   * Returns a readable string for the selected hour interval
   */
  getIntervalLabel(hours: number): string {
    const labels: Record<number, string> = {
      1: 'Every hour',
      2: 'Every 2 hours',
      3: 'Every 3 hours',
      4: 'Every 4 hours',
      6: 'Every 6 hours',
      8: 'Every 8 hours',
      12: 'Every 12 hours',
      24: 'Once daily',
    };
    return labels[hours] || `Every ${hours} hours`;
  }

  /**
   * Simple validation check for the Save button
   */
  get isFormValid(): boolean {
    return !!(
      this.med.name.trim() &&
      this.med.pillsPerDose > 0 &&
      this.med.dosageUnit &&
      this.med.durationDays > 0
    );
  }

  // --- IMAGE MANAGEMENT ---

  /**
   * Opens an action sheet to select image source
   */
  async selectPrescriptionImage() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Prescription Photo',
      buttons: [
        { text: 'Camera', icon: 'camera', handler: () => this.handleImageInput('camera') },
        { text: 'Gallery', icon: 'images', handler: () => this.handleImageInput('gallery') },
        { text: 'Cancel', icon: 'close', role: 'cancel' }
      ]
    });
    await actionSheet.present();
  }

  /**
   * Handles file input and conversion to Base64 for preview
   */
  private handleImageInput(source: 'camera' | 'gallery') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';

    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e: any) => {
          this.prescriptionImage = e.target.result as string;
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  }

  /**
   * Clears the current image selection
   */
  removePrescriptionImage() {
    this.prescriptionImage = null;
    this.med.prescriptionImageUrl = undefined;
  }

  // --- PERSISTENCE ---

  /**
   * Validates and sends the medication data to the service
   */
  async saveMedication() {
    if (!this.isFormValid) return;

    // Combine current pill amount and unit into the readable dosage field
    this.med.dosage = `${this.med.pillsPerDose} ${this.med.dosageUnit}`;
    this.med.updatedAt = new Date();

    try {
      if (this.isEditMode && this.medication?.id) {
        // Handle Update logic
        if (this.prescriptionImage) this.med.prescriptionImageUrl = this.prescriptionImage;
        
        await this.medService.updateMedication(this.medication.id, this.med);
        this.showToast('Medication updated successfully.');
      } else {
        // Handle Create logic
        this.med.createdAt = new Date();
        await this.medService.addMedication(this.med, this.prescriptionImage || undefined);
        this.showToast('Medication saved.');
      }
      this.modalCtrl.dismiss({ saved: true });
    } catch (error) {
      console.error('Save Medication Error:', error);
      this.showToast('Error saving medication. Please try again.');
    }
  }

  /**
   * Helper to display feedback to the user
   */
  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'dark'
    });
    toast.present();
  }
}