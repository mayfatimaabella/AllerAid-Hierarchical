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
  prescriptionImage: string | null = null;
  todayISO: string = new Date().toISOString();

  med: Medication = {
    name: '', brandName: '', dosage: '', frequency: '', quantity: 0,
    refillsRemaining: 0, startDate: new Date().toISOString(), startTime: '', 
    medicineExpiryDate: new Date().toISOString(), notes: '', category: 'other',
    isActive: true, pillsPerDose: null as any, intervalHours: null as any, 
    durationDays: null as any, dosageUnit: 'tablet(s)', medicationType: 'tablet', 
    expiryDate: new Date().toISOString(), status: 'Ongoing'
  };

  constructor(
    private modalCtrl: ModalController,
    private medService: MedicationService,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController
  ) {}

  ngOnInit() {
    if (this.isEditMode && this.medication) {
      this.med = { ...this.medication };
      if (this.med.startDate) this.med.startDate = new Date(this.med.startDate).toISOString();
      
      // FIX: Only overwrite startTime if it doesn't already exist in the record
      if (!this.med.startTime && this.med.startDate) {
        this.extractStartTimeFromDate();
      }
      if (this.med.medicineExpiryDate) this.med.medicineExpiryDate = new Date(this.med.medicineExpiryDate).toISOString();
      if (this.medication.prescriptionImageUrl) this.prescriptionImage = this.medication.prescriptionImageUrl;
      this.onDateOrIntervalChange();
    } else {
      this.med.startDate = this.todayISO;
      this.med.medicineExpiryDate = this.todayISO;
      
      // FIX: Only extract a placeholder time string if the user hasn't explicitly set one
      if (!this.med.startTime) {
        this.extractStartTimeFromDate();
      }
      this.onDateOrIntervalChange();
    }
  }

  public onTypeChange() {
    const unitMap: Record<string, string> = {
      tablet: 'tablet(s)', capsule: 'capsule(s)', liquid: 'ml',
      injection: 'unit(s)', inhaler: 'puff(s)', drops: 'drop(s)',
      cream: 'application(s)', other: 'dose(s)'
    };
    this.med.dosageUnit = unitMap[this.med.medicationType] || 'dose(s)';
    this.onDateOrIntervalChange();
  }

  public onDateOrIntervalChange() {
  if (this.med.startDate && this.med.durationDays != null) {
    const selectedDate = new Date(this.med.startDate);
    
    // 1. Update the startTime property whenever the Date picker changes
    this.med.startTime = selectedDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
    
    // 2. Existing logic for Expiry Date
    const days = parseFloat(this.med.durationDays.toString()) || 0;
    const end = new Date(selectedDate.getTime() + (days * 24 * 60 * 60 * 1000));
    this.med.expiryDate = end.toISOString();

    this.calculateTotalPills();
    this.med.frequency = `${days} day(s) (${this.getIntervalLabel(Number(this.med.intervalHours) || 24)})`;
  }
}

  private calculateTotalPills() {
    const interval = Number(this.med.intervalHours) || 24;
    const duration = parseFloat(this.med.durationDays?.toString() || '0');
    const perDose = Number(this.med.pillsPerDose) || 0;

    if (interval > 0 && duration >= 0 && perDose > 0) {
      this.med.quantity = Math.ceil((24 / interval) * duration * perDose);
    }
  }

  public get isFormValid(): boolean {
    return !!(
      this.med.name?.trim() &&
      this.med.brandName?.trim() &&
      Number(this.med.pillsPerDose) > 0 &&
      this.med.dosageUnit &&
      Number(this.med.durationDays) >= 0 &&
      (Number(this.med.intervalHours) || 0) > 0
    );
  }

  public async saveMedication() {
    if (!this.isFormValid) return;

    this.med.dosage = `${this.med.pillsPerDose} ${this.med.dosageUnit}`;
    
    // FIX: Only overwrite if it was left empty by the user input
    if (!this.med.startTime) {
      this.extractStartTimeFromDate();
    }
    
    if (!this.med.notes || this.med.notes.trim() === '') {
      this.med.notes = '';
    }

    // Calculate and store reminderTimes based on startTime and intervalHours
    if (this.med.startTime && this.med.intervalHours) {
      this.med.reminderTimes = this.calculateReminderTimes();
    }

    if (!this.isEditMode) {
      // --- CORRECTED SYSTEM DEDUCTION LOGIC ---
      const now = new Date().getTime();
      const start = new Date(this.med.startDate).getTime();
      const intervalHrs = Number(this.med.intervalHours) || 24;
      
      const timePassed = now - start;
      const intervalMs = intervalHrs * 3600000;

      let consumedAmount = 0;

      if (timePassed >= 0) {
        // Uses a 1-minute buffer window (60000ms) so that an exact current interval 
        // match counts as an active present task rather than an auto-deducted past dose.
        const intervalsPassed = Math.floor(Math.max(0, (timePassed - 60000) / intervalMs));
        consumedAmount = (1 + intervalsPassed) * Number(this.med.pillsPerDose);
      }

      this.med.refillsRemaining = Math.max(0, Number(this.med.quantity) - consumedAmount);
      this.med.status = 'Ongoing'; 
    }

    try {
      const cleanMed = JSON.parse(JSON.stringify(this.med));
      if (this.isEditMode && this.medication?.id) {
        if (this.prescriptionImage) cleanMed.prescriptionImageUrl = this.prescriptionImage;
        await this.medService.updateMedication(this.medication.id, cleanMed);
      } else {
        await this.medService.addMedication(cleanMed, this.prescriptionImage || undefined);
      }
      this.modalCtrl.dismiss({ saved: true });
    } catch (error) {
      console.error("DEBUG: Firestore Rejection:", error);
      this.showToast('Error saving: Check console for error details.');
    }
  }

  /**
   * Calculate reminder times based on start time and interval hours
   */
  private calculateReminderTimes(): string[] {
    if (!this.med.startTime || !this.med.intervalHours) return [];

    const times: string[] = [];
    const [startHour, startMin] = this.med.startTime.split(':').map(Number);
    const intervalMs = Number(this.med.intervalHours) * 60 * 60 * 1000;
    
    let currentTime = new Date();
    currentTime.setHours(startHour, startMin, 0, 0);
    
    // Generate up to 5 reminder times (or until end of day)
    for (let i = 0; i < 5; i++) {
      if (currentTime.getHours() >= 24) break; // Stop if past midnight
      times.push(`${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`);
      currentTime.setTime(currentTime.getTime() + intervalMs);
    }
    
    return times;
  }

  public getStatusLabel(): string {
    if (this.medService.isExpired && this.medService.isExpired(this.med)) return 'Expired';
    if ((this.med.refillsRemaining || 0) <= 0) return 'Completed';
    return this.med.status || 'Ongoing';
  }

  public getStatusColor(): string {
    const label = this.getStatusLabel();
    return label === 'Completed' ? 'primary' : label === 'Expired' ? 'danger' : 'success';
  }

  public get amountLabel(): string {
    const types: any = { liquid: 'Amount (ml)', injection: 'Dose/Units', inhaler: 'Puffs', drops: 'Drops', cream: 'Application' };
    return types[this.med.medicationType] || 'Pills Per Dose';
  }

  public getIntervalLabel(hours: number): string {
    const labels: any = { 1: '1hr', 4: '4hrs', 8: '8hrs', 12: '12hrs', 24: 'Once daily' };
    return labels[hours] || `${hours}hrs`;
  }

  public async selectPrescriptionImage() {
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
    input.type = 'file'; input.accept = 'image/*';
    if (source === 'camera') input.capture = 'environment';
    input.onchange = (event: any) => {
      const reader = new FileReader();
      reader.onload = (e: any) => this.prescriptionImage = e.target.result;
      reader.readAsDataURL(event.target.files[0]);
    };
    input.click();
  }

  public removePrescriptionImage() { this.prescriptionImage = null; this.med.prescriptionImageUrl = undefined; }
  public dismiss() { this.modalCtrl.dismiss(); }
  
  private extractStartTimeFromDate() { 
    this.med.startTime = new Date(this.med.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }); 
  }
  
  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      position: 'bottom',
      color: 'dark'
    });
    await toast.present();
  }
}