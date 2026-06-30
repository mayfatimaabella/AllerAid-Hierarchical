import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, ActionSheetController, LoadingController } from '@ionic/angular';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';
import { createWorker } from 'tesseract.js';

@Component({
  selector: 'app-add-edit-medication',
  templateUrl: './add-edit-medication.component.html',
  styleUrls: ['./add-edit-medication.component.scss'],
  standalone: false,
})
export class AddEditMedicationComponent implements OnInit {
  medication?: Medication;
  isEditMode = false;

  prescriptionImage: string | null = null;
  todayISO: string = new Date().toISOString();

  isOcrProcessing = false;
  ocrText = '';

  med: any = {
    name: '',
    brandName: '',
    dosage: '',
    frequency: '',
    quantity: 0,
    refillsRemaining: 0,

    startDate: new Date().toISOString(),
    startTime: '',

    medicineExpiryDate: new Date().toISOString(),
    expiryDate: new Date().toISOString(),

    notes: '',
    category: 'other',
    isActive: true,

    pillsPerDose: null,
    intervalHours: null,
    durationDays: null,

    dosageUnit: 'mg',
    medicationType: 'tablet',
    customMedicationType: '',

    status: 'Ongoing',
    strength: '',

    prescribedBy: '',
    reminderTimes: []
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private medService: MedicationService,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const medicationId = params['id'];

      if (medicationId) {
        this.isEditMode = true;
        this.loadMedication(medicationId);
      } else {
        this.initializeNewMedication();
      }
    });
  }

  private initializeNewMedication(): void {
    const now = new Date();

    this.med.startDate = now.toISOString();
    this.med.startTime = this.formatDisplayTime(now);
    this.med.medicineExpiryDate = now.toISOString();
    this.med.expiryDate = now.toISOString();

    this.onTypeChange();
    this.onDateOrIntervalChange();
  }

  private async loadMedication(medicationId: string): Promise<void> {
    try {
      const meds = await this.medService.getUserMedications();
      this.medication = meds.find(m => m.id === medicationId);

      if (!this.medication) {
        this.showToast('Medication not found', 'warning');
        this.router.navigate(['/tabs/medication']);
        return;
      }

      this.med = {
        ...this.med,
        ...this.medication
      };

      if (!this.med.strength) this.med.strength = '';
      if (!this.med.customMedicationType) this.med.customMedicationType = '';

      if (this.med.startDate) {
        this.med.startDate = new Date(this.med.startDate).toISOString();
        this.extractStartTimeFromDate();
      }

      if (this.med.medicineExpiryDate) {
        this.med.medicineExpiryDate = new Date(this.med.medicineExpiryDate).toISOString();
      }

      if (this.med.expiryDate) {
        this.med.expiryDate = new Date(this.med.expiryDate).toISOString();
      }

      if (this.medication.prescriptionImageUrl) {
        this.prescriptionImage = this.medication.prescriptionImageUrl;
      }

      this.onTypeChange();
      this.onDateOrIntervalChange();
    } catch (error) {
      console.error('Error loading medication:', error);
      this.showToast('Error loading medication', 'danger');
    }
  }

  public getAvailableUnits(): string[] {
    const type = this.med.medicationType || 'tablet';

    const unitMap: Record<string, string[]> = {
      tablet: ['mg', 'mcg', 'g', 'IU'],
      capsule: ['mg', 'mcg', 'g', 'IU'],
      liquid: ['ml', 'tsp', 'tbsp', 'mg/ml', '%'],
      injection: ['ml', 'mg/ml', 'IU/ml'],
      inhaler: ['puffs', 'mcg', 'mg'],
      drops: ['drops', 'ml', '%'],
      cream: ['g', 'mg/g', '%'],
      other: ['mg', 'mcg', 'g', 'ml', '%', 'IU', 'puffs', 'drops']
    };

    return unitMap[type] || unitMap['other'];
  }

  public onTypeChange(): void {
    const units = this.getAvailableUnits();

    if (!units.includes(this.med.dosageUnit)) {
      this.med.dosageUnit = units[0];
    }

    this.onDateOrIntervalChange();
  }

  public onDateOrIntervalChange(): void {
    if (!this.med.startDate) return;

    const selectedDate = new Date(this.med.startDate);

    if (isNaN(selectedDate.getTime())) return;

    this.med.startTime = this.formatDisplayTime(selectedDate);

    const days = Number(this.med.durationDays) || 0;
    const interval = Number(this.med.intervalHours) || 24;

    if (days > 0) {
      const end = new Date(selectedDate.getTime() + days * 24 * 60 * 60 * 1000);
      this.med.expiryDate = end.toISOString();
    }

    this.calculateTotalPills();

    if (days > 0 && interval > 0) {
      this.med.frequency = `${days} day(s) (${this.getIntervalLabel(interval)})`;
    }
  }

  private calculateTotalPills(): void {
    const interval = Number(this.med.intervalHours) || 24;
    const duration = Number(this.med.durationDays) || 0;
    const perDose = Number(this.med.pillsPerDose) || 0;

    if (interval > 0 && duration > 0 && perDose > 0) {
      this.med.quantity = Math.ceil((24 / interval) * duration * perDose);
    } else {
      this.med.quantity = 0;
    }
  }

  public get isFormValid(): boolean {
    const hasBasicFields =
      this.med.name?.trim() &&
      this.med.brandName?.trim() &&
      this.med.medicationType &&
      Number(this.med.pillsPerDose) > 0 &&
      this.med.strength?.toString().trim() &&
      this.med.dosageUnit &&
      Number(this.med.durationDays) > 0 &&
      Number(this.med.intervalHours) > 0 &&
      this.med.startDate &&
      this.med.medicineExpiryDate;

    const otherTypeValid =
      this.med.medicationType !== 'other' ||
      this.med.customMedicationType?.trim();

    return !!(hasBasicFields && otherTypeValid);
  }

  public async saveMedication(): Promise<void> {
    if (!this.isFormValid) {
      this.showToast('Please complete all required fields.', 'warning');
      return;
    }

    this.extractStartTimeFromDate();
    this.calculateTotalPills();

    const finalMedicationType =
      this.med.medicationType === 'other'
        ? this.med.customMedicationType.trim()
        : this.med.medicationType;

    this.med.dosage = `${this.med.pillsPerDose} ${this.med.medicationType === 'inhaler' ? 'puff(s)' : 'dose(s)'} of ${this.med.strength} ${this.med.dosageUnit}`;

    this.med.frequency = `${this.med.durationDays} day(s) (${this.getIntervalLabel(Number(this.med.intervalHours))})`;

    this.med.reminderTimes = this.calculateReminderTimes();

    const cleanMed = {
      ...this.med,
      medicationType: finalMedicationType,
      originalMedicationType: this.med.medicationType,
      prescriptionImageUrl: this.prescriptionImage || this.med.prescriptionImageUrl || null,
      ocrText: this.ocrText || ''
    };

    try {
      const dataToSave = JSON.parse(JSON.stringify(cleanMed));

      if (this.isEditMode && this.medication?.id) {
        await this.medService.updateMedication(this.medication.id, dataToSave);
        this.showToast('Medication updated successfully!', 'success');
      } else {
        await this.medService.addMedication(dataToSave, this.prescriptionImage || undefined);
        this.showToast('Medication saved successfully!', 'success');
      }

      this.router.navigate(['/tabs/medication']);
    } catch (error) {
      console.error('Error saving medication:', error);
      this.showToast('Error saving medication.', 'danger');
    }
  }

  private calculateReminderTimes(): string[] {
    if (!this.med.startDate || !this.med.intervalHours) return [];

    const times: string[] = [];
    const intervalHours = Number(this.med.intervalHours);

    if (intervalHours <= 0) return [];

    const start = new Date(this.med.startDate);

    if (isNaN(start.getTime())) return [];

    const currentTime = new Date(start);
    const startDay = currentTime.getDate();

    while (currentTime.getDate() === startDay && times.length < 24) {
      times.push(
        `${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`
      );

      currentTime.setHours(currentTime.getHours() + intervalHours);
    }

    return times;
  }

  public get amountLabel(): string {
    const labels: Record<string, string> = {
      tablet: 'How many tablets per dose?',
      capsule: 'How many capsules per dose?',
      liquid: 'How many ml/spoons per dose?',
      injection: 'How many injections per dose?',
      inhaler: 'How many puffs per dose?',
      drops: 'How many drops per dose?',
      cream: 'How much per dose?',
      other: 'How many per dose?'
    };

    return labels[this.med.medicationType] || 'How many per dose?';
  }

  public getIntervalLabel(hours: number): string {
    const labels: Record<number, string> = {
      1: 'Every 1 hour',
      2: 'Every 2 hours',
      3: 'Every 3 hours',
      4: 'Every 4 hours',
      6: 'Every 6 hours',
      8: 'Every 8 hours',
      12: 'Every 12 hours',
      24: 'Once daily'
    };

    return labels[hours] || `Every ${hours} hours`;
  }

  public async selectPrescriptionImage(): Promise<void> {
    const actionSheet = await this.actionSheetController.create({
      header: 'Prescription Photo',
      buttons: [
        {
          text: 'Camera',
          icon: 'camera',
          handler: () => this.handleImageInput('camera')
        },
        {
          text: 'Gallery',
          icon: 'images',
          handler: () => this.handleImageInput('gallery')
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

  private handleImageInput(source: 'camera' | 'gallery'): void {
    const input = document.createElement('input');

    input.type = 'file';
    input.accept = 'image/*';

    if (source === 'camera') {
      input.capture = 'environment';
    }

    input.onchange = async (event: any) => {
      const file = event.target.files?.[0];

      if (!file) return;

      const reader = new FileReader();

      reader.onload = async (e: any) => {
        this.prescriptionImage = e.target.result;
        await this.runOcrFromImage(this.prescriptionImage);
      };

      reader.readAsDataURL(file);
    };

    input.click();
  }

  public async runOcrFromImage(imageData?: string | null): Promise<void> {
    const image = imageData || this.prescriptionImage;

    if (!image) {
      this.showToast('Please add a prescription image first.', 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Reading prescription image...'
    });

    await loading.present();

    this.isOcrProcessing = true;

    try {
      const worker = await createWorker('eng');

      const result = await worker.recognize(image);
      const extractedText = result.data.text || '';

      await worker.terminate();

      this.ocrText = extractedText.trim();

      if (!this.ocrText) {
        this.showToast('No readable text found in image.', 'warning');
        return;
      }

      this.applyOcrTextToForm(this.ocrText);

      this.showToast('OCR completed. Please review the detected details.', 'success');
    } catch (error) {
      console.error('OCR error:', error);
      this.showToast('Could not read prescription image.', 'danger');
    } finally {
      this.isOcrProcessing = false;
      await loading.dismiss();
    }
  }

  private applyOcrTextToForm(text: string): void {
    const cleanText = text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.%/-]/g, '')
      .trim();

    const lowerText = cleanText.toLowerCase();

    const strengthMatch = cleanText.match(/(\d+(?:\.\d+)?)\s?(mg|mcg|g|ml|iu|%)/i);

    if (strengthMatch) {
      this.med.strength = strengthMatch[1];
      this.med.dosageUnit = strengthMatch[2].toLowerCase();
    }

    const durationMatch =
      cleanText.match(/(?:for|x)\s?(\d+)\s?(day|days|d)/i) ||
      cleanText.match(/(\d+)\s?(day|days|d)/i);

    if (durationMatch) {
      this.med.durationDays = Number(durationMatch[1]);
    }

    const intervalMatch =
      cleanText.match(/every\s?(\d+)\s?(hour|hours|hr|hrs)/i) ||
      cleanText.match(/q\s?(\d+)\s?h/i);

    if (intervalMatch) {
      this.med.intervalHours = Number(intervalMatch[1]);
    } else if (
      lowerText.includes('once daily') ||
      lowerText.includes('od') ||
      lowerText.includes('daily')
    ) {
      this.med.intervalHours = 24;
    } else if (
      lowerText.includes('twice daily') ||
      lowerText.includes('bid')
    ) {
      this.med.intervalHours = 12;
    } else if (
      lowerText.includes('three times daily') ||
      lowerText.includes('tid')
    ) {
      this.med.intervalHours = 8;
    } else if (
      lowerText.includes('four times daily') ||
      lowerText.includes('qid')
    ) {
      this.med.intervalHours = 6;
    }

    const doseMatch =
      cleanText.match(/take\s?(\d+(?:\.\d+)?)\s?(tablet|tablets|capsule|capsules|ml|puff|puffs|drop|drops)/i) ||
      cleanText.match(/(\d+(?:\.\d+)?)\s?(tablet|tablets|capsule|capsules|ml|puff|puffs|drop|drops)/i);

    if (doseMatch) {
      this.med.pillsPerDose = Number(doseMatch[1]);

      const doseType = doseMatch[2].toLowerCase();

      if (doseType.includes('tablet')) this.med.medicationType = 'tablet';
      else if (doseType.includes('capsule')) this.med.medicationType = 'capsule';
      else if (doseType.includes('ml')) this.med.medicationType = 'liquid';
      else if (doseType.includes('puff')) this.med.medicationType = 'inhaler';
      else if (doseType.includes('drop')) this.med.medicationType = 'drops';

      this.onTypeChange();
    }

    const expiryMatch =
      cleanText.match(/(?:exp|expiry|expires)\s?(?:date)?\s?(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i);

    if (expiryMatch) {
      const parsedExpiry = this.parseDateFromOcr(expiryMatch[1]);

      if (parsedExpiry) {
        this.med.medicineExpiryDate = parsedExpiry.toISOString();
      }
    }

    const doctorMatch =
      cleanText.match(/(?:dr|doctor)\.?\s?([a-zA-Z\s]{2,40})/i);

    if (doctorMatch) {
      this.med.prescribedBy = `Dr. ${doctorMatch[1].trim()}`;
    }

    const detectedName = this.detectMedicationName(cleanText);

    if (detectedName && !this.med.name?.trim()) {
      this.med.name = detectedName;
    }

    if (!this.med.notes?.trim()) {
      this.med.notes = `OCR text:\n${text}`;
    }

    this.onDateOrIntervalChange();
  }

  private detectMedicationName(text: string): string {
    const words = text
      .split(' ')
      .map(word => word.trim())
      .filter(word => word.length > 2);

    const ignoreWords = [
      'take', 'tablet', 'tablets', 'capsule', 'capsules', 'daily',
      'twice', 'three', 'times', 'every', 'hours', 'hour', 'days',
      'doctor', 'patient', 'prescription', 'medicine', 'expiry',
      'date', 'before', 'after', 'meal', 'meals'
    ];

    const possibleName = words.find(word => {
      const cleaned = word.toLowerCase();

      return (
        /^[a-zA-Z]+$/.test(word) &&
        !ignoreWords.includes(cleaned)
      );
    });

    return possibleName || '';
  }

  private parseDateFromOcr(dateText: string): Date | null {
    const parts = dateText.split(/[/-]/).map(Number);

    if (parts.length !== 3) return null;

    let [month, day, year] = parts;

    if (year < 100) {
      year += 2000;
    }

    const date = new Date(year, month - 1, day);

    if (isNaN(date.getTime())) return null;

    return date;
  }

  public removePrescriptionImage(): void {
    this.prescriptionImage = null;
    this.med.prescriptionImageUrl = null;
    this.ocrText = '';
  }

  public dismiss(): void {
    this.router.navigate(['/tabs/medication']);
  }

  private extractStartTimeFromDate(): void {
    if (!this.med.startDate) return;

    const date = new Date(this.med.startDate);

    if (isNaN(date.getTime())) return;

    this.med.startTime = this.formatDisplayTime(date);
  }

  private formatDisplayTime(date: Date): string {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  private async showToast(message: string, color: string = 'dark'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color
    });

    await toast.present();
  }
}