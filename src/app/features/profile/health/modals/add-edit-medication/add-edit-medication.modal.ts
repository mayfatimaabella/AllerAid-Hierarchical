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
  medication?: Medication; // Input property for edit mode
  isEditMode: boolean = false; // Input property for edit mode
  
  med: Medication = {
    name: '',
    dosage: '',
    frequency: '', // Duration like "10 days"
    quantity: 0, // Number of pills
    startDate: new Date().toISOString(),
    notes: '',
    category: 'other',
    isActive: true
  };

  prescriptionImage: string | null = null;
  medicationImage: string | null = null;
  todayISO: string = new Date().toISOString();
  isDurationManual: boolean = false; // Track if user manually edited duration
  projectedEndDate: Date | null = null;
  projectedDaysSupply: number | null = null;

  constructor(
    private modalCtrl: ModalController,
    private medService: MedicationService,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController
  ) {}

  ngOnInit() {
    // If in edit mode, populate the form with existing medication data
    if (this.isEditMode && this.medication) {
      this.med = { ...this.medication };
      // Parse dosage string into amount and unit if it exists
      if (this.med.dosage && !this.med.dosageAmount && !this.med.dosageUnit) {
        this.parseDosage(this.med.dosage);
      }
      // Convert date strings to ISO format if they exist
      if (this.med.startDate && typeof this.med.startDate === 'string') {
        this.med.startDate = new Date(this.med.startDate).toISOString();
      }
      if (this.med.expiryDate && typeof this.med.expiryDate === 'string') {
        this.med.expiryDate = new Date(this.med.expiryDate).toISOString();
      }
      // Load existing images if they exist
      if (this.medication.prescriptionImageUrl) {
        this.prescriptionImage = this.medication.prescriptionImageUrl;
      }
      if (this.medication.medicationImageUrl) {
        this.medicationImage = this.medication.medicationImageUrl;
      }
    } else {
      // Default start date to today for new medications
      this.med.startDate = this.todayISO;
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  // Parse dosage string (e.g., "50mg") into amount and unit
  parseDosage(dosageString: string) {
    const match = dosageString.match(/^(\d+(?:\.\d+)?)\s*(.+)$/);
    if (match) {
      this.med.dosageAmount = parseFloat(match[1]);
      this.med.dosageUnit = match[2].trim();
    }
  }

  // Combine dosage amount and unit into a single string (e.g., "50mg")
  combineDosage(): string {
    if (this.med.dosageAmount && this.med.dosageUnit) {
      // Include a space for readability, e.g., "50 mg"
      return `${this.med.dosageAmount} ${this.med.dosageUnit}`;
    }
    return '';
  }

  /**
   * Core pill-supply calculator.
   * Given quantity + intervalHours + startDate 
   * → computes expiryDate & frequency text + projections.
   * Called whenever quantity, interval, or startDate changes.
   */
  calculateExpiryFromPills() {
    if (this.isDurationManual) return;

    const quantity = Number(this.med.quantity);
    const intervalHours = this.med.intervalHours !== undefined && this.med.intervalHours !== null
      ? Number(this.med.intervalHours)
      : NaN;

    // Need at least pills and a valid interval to calculate
    if (!quantity || quantity <= 0 || isNaN(intervalHours) || intervalHours <= 0) {
      this.projectedEndDate = null;
      this.projectedDaysSupply = null;
      return;
    }

    const dosesPerDay = 24 / intervalHours;
    const daysOfSupply = Math.ceil(quantity / dosesPerDay);
    this.projectedDaysSupply = daysOfSupply;

    const start = this.med.startDate ? new Date(this.med.startDate) : new Date();
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + daysOfSupply);
    this.projectedEndDate = expiry;

    // Auto-fill expiry date and frequency description
    this.med.expiryDate = expiry.toISOString();
    const intervalLabel = this.getIntervalLabel(intervalHours);
    const daysText = `${daysOfSupply} day${daysOfSupply === 1 ? '' : 's'}`;
    this.med.frequency = `${daysText}, ${intervalLabel}`;
  }

  getIntervalLabel(hours: number): string {
    const map: Record<number, string> = {
      1: 'every 1 hour',
      2: 'every 2 hours',
      3: 'every 3 hours',
      4: 'every 4 hours',
      6: 'every 6 hours',
      8: 'every 8 hours',
      12: 'every 12 hours',
      24: 'once a day',
    };
    return map[hours] ?? `every ${hours} hours`;
  }

  // Keep this for callers; delegates to the pill-based calculator
  calculateDuration() {
    if (this.isDurationManual) return;
    this.calculateExpiryFromPills();
  }

  // Handle manual duration input
  onDurationChange() {
    this.isDurationManual = true;
  }

  // Toggle between manual and auto-calculated duration
  toggleDurationMode() {
    this.isDurationManual = !this.isDurationManual;
    if (!this.isDurationManual) {
      // If switching back to auto mode, recalculate from pills
      this.calculateExpiryFromPills();
    }
  }

  // Handle start date change
  onStartDateChange() {
    this.calculateExpiryFromPills();
  }

  // Handle expiry date change
  onExpiryDateChange() {
    this.calculateDuration();
  }

  // Handle interval (hours) change
  onIntervalChange() {
    this.calculateExpiryFromPills();
  }

  // Validate quantity input
  validateQuantity(): boolean {
    const quantity = Number(this.med.quantity);
    // Modified: allow 0 so medication can be marked as finished
    return !isNaN(quantity) && quantity >= 0 && quantity <= 999 && Number.isInteger(quantity);
  }

  // Handle quantity input change
  onQuantityChange() {
    if (this.med.quantity !== undefined) {
      const numQuantity = Number(this.med.quantity);
      if (numQuantity < 0) {
        this.med.quantity = 0;
      } else if (numQuantity > 999) {
        this.med.quantity = 999;
      } else {
        this.med.quantity = Math.floor(numQuantity); // Ensure integer
      }

      this.calculateExpiryFromPills();
    }
  }

  // Check if the form is valid for submission
  get isFormValid(): boolean {
    const hasBasicFields = !!(this.med.name.trim() && 
                             this.med.dosageAmount && 
                             this.med.dosageUnit && 
                             this.validateQuantity());

    return hasBasicFields;
  }

  // Inline validation message for dosage amount
  get dosageAmountError(): string | null {
    const value: any = this.med.dosageAmount;

    // Don't show an error while empty; "required" is handled by form disable/toast
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const numeric = Number(value);
    if (isNaN(numeric)) {
      return 'Please enter a valid number.';
    }
    if (numeric <= 0) {
      return 'Dosage amount must be greater than 0.';
    }
    if (numeric > 10000) {
      return 'Dosage amount seems too large (max 10000).';
    }

    return null;
  }

  // Inline validation message for quantity (number of pills)
  get quantityError(): string | null {
    const value: any = this.med.quantity;

    if (value === undefined || value === null || value === '') {
      return null;
    }

    const quantity = Number(value);
    if (isNaN(quantity)) {
      return 'Please enter a valid number of pills.';
    }
    if (!Number.isInteger(quantity)) {
      return 'Number of pills must be a whole number.';
    }
    if (quantity < 0) {
      return 'Number of pills cannot be negative.';
    }
    if (quantity > 999) {
      return 'Number of pills cannot exceed 999.';
    }

    return null;
  }

  async selectPrescriptionImage() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Select Prescription Image',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera',
          handler: () => {
            this.takePrescriptionPhoto();
          }
        },
        {
          text: 'Choose from Gallery',
          icon: 'images',
          handler: () => {
            this.selectPrescriptionFromGallery();
          }
        },
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async selectMedicationImage() {
    const actionSheet = await this.actionSheetController.create({
      header: 'Select Medication Image',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera',
          handler: () => {
            this.takeMedicationPhoto();
          }
        },
        {
          text: 'Choose from Gallery',
          icon: 'images',
          handler: () => {
            this.selectMedicationFromGallery();
          }
        },
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  takePrescriptionPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (event: any) => {
      this.handlePrescriptionImageSelect(event);
    };
    input.click();
  }

  selectPrescriptionFromGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: any) => {
      this.handlePrescriptionImageSelect(event);
    };
    input.click();
  }

  takeMedicationPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (event: any) => {
      this.handleMedicationImageSelect(event);
    };
    input.click();
  }

  selectMedicationFromGallery() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (event: any) => {
      this.handleMedicationImageSelect(event);
    };
    input.click();
  }

  handlePrescriptionImageSelect(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        this.presentToast('Image size must be less than 5MB');
        return;
      }
      
      // Compress and resize the image
      this.compressImage(file, (compressedDataUrl) => {
        this.prescriptionImage = compressedDataUrl;
        this.med.prescriptionImageName = file.name;
        this.presentToast('Prescription image added');
      });
    }
  }

  handleMedicationImageSelect(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        this.presentToast('Image size must be less than 5MB');
        return;
      }
      
      // Compress and resize the image
      this.compressImage(file, (compressedDataUrl) => {
        this.medicationImage = compressedDataUrl;
        this.med.medicationImageName = file.name;
        this.presentToast('Medication image added');
      });
    }
  }

  private compressImage(file: File, callback: (compressedDataUrl: string) => void) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      const maxSize = 600;
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.5);
      callback(compressedDataUrl);
    };
    
    const reader = new FileReader();
    reader.onload = (e: any) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  removePrescriptionImage() {
    this.prescriptionImage = null;
    this.med.prescriptionImageName = undefined;
    this.med.prescriptionImageUrl = undefined;
  }

  removeMedicationImage() {
    this.medicationImage = null;
    this.med.medicationImageName = undefined;
    this.med.medicationImageUrl = undefined;
  }

  async saveMedication() {
    if (!this.med.name.trim()) {
      this.presentToast('Please enter medication name');
      return;
    }

    if (!this.med.dosageAmount || !this.med.dosageUnit) {
      this.presentToast('Please enter dosage amount and unit');
      return;
    }

    this.med.dosage = this.combineDosage();

    if (!this.validateQuantity()) {
      this.presentToast('Please enter a valid number of pills (0-999)');
      return;
    }

    this.med.quantity = Number(this.med.quantity);

    const now = new Date();

    if (this.med.expiryDate) {
      const expiry = new Date(this.med.expiryDate);
      if (expiry < now) {
        this.presentToast('Expiry date is in the past. Please update it.');
        return;
      }
    }

    if (this.med.startDate) {
      const start = new Date(this.med.startDate);
      const diffDays = (now.getTime() - start.getTime()) / (1000 * 3600 * 24);

      if (start > now) {
        this.presentToast('Start date cannot be in the future. Please update it.');
        return;
      }

      // Hard block: start date more than 90 days in the past
      if (diffDays > 90) {
        this.presentToast(
          `Start date is ${Math.floor(diffDays)} days ago — that seems too far back. ` +
          `Please correct it before saving.`
        );
        return;
      }
    }

    // --- AUTO-STATUS LOGIC ---
    // Check if medication is expired or finished
    const isExpired = this.med.expiryDate && new Date(this.med.expiryDate) < now;
    const isOutOfPills = this.med.quantity <= 0;

    if (isExpired || isOutOfPills) {
      this.med.isActive = false; // Auto-deactivate
    } else {
      this.med.isActive = true; // Reactive if dates/stock are corrected
    }

    if (!this.med.frequency?.trim()) {
      this.calculateExpiryFromPills();
    }

    try {
      if (!this.isEditMode) {
        this.med.createdAt = new Date();
      }
      this.med.updatedAt = new Date();
      
      if (this.isEditMode && this.medication?.id) {
        if (this.prescriptionImage) this.med.prescriptionImageUrl = this.prescriptionImage;
        if (this.medicationImage) this.med.medicationImageUrl = this.medicationImage;
        
        await this.medService.updateMedication(this.medication.id, this.med);
        this.presentToast('Medication updated successfully');
      } else {
        await this.medService.addMedication(
          this.med, 
          this.prescriptionImage || undefined, 
          this.medicationImage || undefined
        );
        this.presentToast('Medication added successfully');
      }
      
      this.modalCtrl.dismiss({ saved: true });
    } catch (error) {
      console.error('Error saving medication:', error);
      this.presentToast('Error saving medication');
    }
  }

  // Helper logic for status labels in HTML
  getStatusLabel(medication: Medication): string {
    const isExpired = medication.expiryDate && new Date(medication.expiryDate) < new Date();
    if (isExpired) return 'Expired';
    if (medication.quantity !== undefined && medication.quantity <= 0) return 'Finished';
    if (!medication.isActive) return 'Inactive';
    return 'Active';
  }

  getStatusColor(medication: Medication): string {
    const isExpired = medication.expiryDate && new Date(medication.expiryDate) < new Date();
    if (isExpired || (medication.quantity !== undefined && medication.quantity <= 0) || !medication.isActive) {
      return 'danger';
    }
    return 'success';
  }

  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }
}