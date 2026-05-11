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
  medication?: Medication; 
  isEditMode: boolean = false;

  med: Medication = {
    name: '',
    brandName: '',
    dosage: '',
    frequency: '',
    quantity: 0,
    refillsRemaining: 0,
    startDate: new Date().toISOString(),
    startTime: '', 
    medicineExpiryDate: new Date().toISOString(), 
    notes: '',
    category: 'other',
    isActive: true,
    pillsPerDose: 0,
    intervalHours: 0,
    durationDays: 0,
    dosageUnit: 'tablet(s)',
    medicationType: 'tablet', 
    expiryDate: new Date().toISOString()
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
      this.med = { ...this.medication };

      if (this.med.startDate) {
        this.med.startDate = new Date(this.med.startDate).toISOString();
      }
      
      if (!this.med.startTime && this.med.startDate) {
         this.extractStartTimeFromDate();
      }

      if (this.med.medicineExpiryDate) {
        this.med.medicineExpiryDate = new Date(this.med.medicineExpiryDate).toISOString();
      }

      if (this.medication.prescriptionImageUrl) {
        this.prescriptionImage = this.medication.prescriptionImageUrl;
      }

      this.onDateOrIntervalChange();
    } else {
      this.med.startDate = this.todayISO;
      this.med.medicineExpiryDate = this.todayISO;
      this.extractStartTimeFromDate(); 
      this.onDateOrIntervalChange();
    }
  }

  /**
   * Getter for Dynamic Input Labels (Fixes TS2339: amountLabel)
   */
  get amountLabel(): string {
    switch (this.med.medicationType) {
      case 'liquid': return 'Amount (ml)';
      case 'injection': return 'Dose/Units';
      case 'inhaler': return 'Puffs';
      case 'drops': return 'Drops';
      case 'cream': return 'Application';
      default: return 'Pills Per Dose';
    }
  }

  /**
   * Handles unit updates when type changes (Fixes TS2339: onTypeChange)
   */
  onTypeChange() {
    const unitMap: Record<string, string> = {
      tablet: 'tablet(s)',
      capsule: 'capsule(s)',
      liquid: 'ml',
      injection: 'unit(s)',
      inhaler: 'puff(s)',
      drops: 'drop(s)',
      cream: 'application(s)',
      other: 'dose(s)'
    };
    
    if (this.med.medicationType) {
      this.med.dosageUnit = unitMap[this.med.medicationType] || 'dose(s)';
    }
    
    this.onDateOrIntervalChange();
  }

  /**
   * Core logic for recalculating dates and frequencies
   */
  onDateOrIntervalChange() {
    if (this.med.startDate && this.med.durationDays) {
      const start = new Date(this.med.startDate);
      this.extractStartTimeFromDate();

      const days = parseInt(this.med.durationDays.toString(), 10);
      const end = new Date(start);
      end.setDate(start.getDate() + days);
      this.med.expiryDate = end.toISOString();

      this.calculateTotalPills();

      const label = this.getIntervalLabel(this.med.intervalHours || 24);
      this.med.frequency = `${days} days (${label})`;
    }
  }

  /**
   * Fixes TS2339: calculateTotalPills
   */
  private calculateTotalPills() {
    const interval = Number(this.med.intervalHours);
    const duration = Number(this.med.durationDays);
    const perDose = Number(this.med.pillsPerDose);

    if (interval > 0 && duration > 0 && perDose > 0) {
      const dosesPerDay = 24 / interval;
      const totalDoses = dosesPerDay * duration;
      this.med.quantity = Math.ceil(totalDoses * perDose);
    }
  }

  /**
   * Fixes TS2339: getIntervalLabel
   */
  getIntervalLabel(hours: number): string {
    const labels: Record<number, string> = {
      1: 'Every hour', 2: 'Every 2 hours', 3: 'Every 3 hours', 
      4: 'Every 4 hours', 6: 'Every 6 hours', 8: 'Every 8 hours', 
      12: 'Every 12 hours', 24: 'Once daily',
    };
    return labels[hours] || `Every ${hours} hours`;
  }

  /**
   * Fixes TS2339: isFormValid
   */
  get isFormValid(): boolean {
    return !!(
      this.med.name?.trim() &&
      this.med.brandName?.trim() &&
      this.med.pillsPerDose > 0 &&
      this.med.dosageUnit &&
      this.med.durationDays > 0 &&
      (this.med.intervalHours ?? 0) > 0
    );
  }

  /**
   * Extract startTime for display in details modal
   */
  private extractStartTimeFromDate() {
    if (this.med.startDate) {
      const date = new Date(this.med.startDate);
      this.med.startTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  // --- Image Handling (Fixes TS2551 errors) ---

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

  removePrescriptionImage() {
    this.prescriptionImage = null;
    this.med.prescriptionImageUrl = undefined;
  }

  // --- SAVE LOGIC ---

  async saveMedication() {
    if (!this.isFormValid) return;

    this.med.dosage = `${this.med.pillsPerDose} ${this.med.dosageUnit}`;

    if (!this.med.startTime) {
      this.extractStartTimeFromDate();
    }

    const now = new Date().getTime();
    const start = new Date(this.med.startDate).getTime();
    const intervalHrs = Number(this.med.intervalHours) || 24;
    const intervalMs = intervalHrs * 60 * 60 * 1000;
    const pillsPerDose = Number(this.med.pillsPerDose);
    const initialTotal = Number(this.med.quantity);

    if (now >= start) {
      const diffInMs = now - start;
      const intervalsPassed = Math.floor(diffInMs / intervalMs);
      const totalDosesToDeduct = 1 + intervalsPassed; 
      const consumedAmount = totalDosesToDeduct * pillsPerDose;

      const remaining = initialTotal - consumedAmount;
      this.med.refillsRemaining = remaining > 0 ? remaining : 0;
    } else {
      this.med.refillsRemaining = initialTotal;
    }
    
    try {
      if (this.isEditMode && this.medication?.id) {
        if (this.prescriptionImage) this.med.prescriptionImageUrl = this.prescriptionImage;
        await this.medService.updateMedication(this.medication.id, this.med);
      } else {
        await this.medService.addMedication(this.med, this.prescriptionImage || undefined);
      }
      this.modalCtrl.dismiss({ saved: true });
    } catch (error) {
      this.showToast('Error saving medication.');
    }
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

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