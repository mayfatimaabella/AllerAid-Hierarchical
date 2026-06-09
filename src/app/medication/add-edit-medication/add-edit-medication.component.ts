import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, ActionSheetController } from '@ionic/angular';
import { MedicationService, Medication } from 'src/app/core/services/medication.service';

@Component({
  selector: 'app-add-edit-medication',
  templateUrl: './add-edit-medication.component.html',
  styleUrls: ['./add-edit-medication.component.scss'],
  standalone: false,
})
export class AddEditMedicationComponent implements OnInit {
  medication?: Medication;
  isEditMode: boolean = false;
  prescriptionImage: string | null = null;
  todayISO: string = new Date().toISOString();

  // Added strength field to the model
  med: any = {
    name: '', brandName: '', dosage: '', frequency: '', quantity: 0,
    refillsRemaining: 0, startDate: new Date().toISOString(), startTime: '',
    medicineExpiryDate: new Date().toISOString(), notes: '', category: 'other',
    isActive: true, pillsPerDose: null as any, intervalHours: null as any,
    durationDays: null as any, dosageUnit: 'mg', medicationType: 'tablet',
    expiryDate: new Date().toISOString(), status: 'Ongoing',
    strength: '' 
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private medService: MedicationService,
    private toastController: ToastController,
    private actionSheetController: ActionSheetController
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.loadMedication(params['id']);
      } else {
        this.initializeNewMedication();
      }
    });
  }

  // Determines units based on selected medication type
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

  // Ensures unit selection is valid when type changes
  public onTypeChange() {
    const units = this.getAvailableUnits();
    if (!units.includes(this.med.dosageUnit)) {
      this.med.dosageUnit = units[0];
    }
    this.onDateOrIntervalChange();
  }

  private async loadMedication(medicationId: string): Promise<void> {
    try {
      const meds = await this.medService.getUserMedications();
      this.medication = meds.find(m => m.id === medicationId);
      if (this.medication) {
        this.med = { ...this.medication };
        if (!this.med.strength) this.med.strength = '';
        if (this.med.startDate) this.med.startDate = new Date(this.med.startDate).toISOString();
        if (!this.med.startTime && this.med.startDate) this.extractStartTimeFromDate();
        if (this.medication.prescriptionImageUrl) this.prescriptionImage = this.medication.prescriptionImageUrl;
        this.onDateOrIntervalChange();
      }
    } catch (error) {
      console.error('Error loading medication:', error);
      this.showToast('Error loading medication', 'danger');
    }
  }

  private initializeNewMedication(): void {
    this.med.startDate = this.todayISO;
    this.med.medicineExpiryDate = this.todayISO;
    this.extractStartTimeFromDate();
    this.onDateOrIntervalChange();
  }

  public onDateOrIntervalChange() {
    if (this.med.startDate && this.med.durationDays != null) {
      const selectedDate = new Date(this.med.startDate);
      this.med.startTime = selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
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
      this.med.strength?.trim() &&
      this.med.dosageUnit &&
      Number(this.med.durationDays) >= 0 &&
      (Number(this.med.intervalHours) || 0) > 0
    );
  }

  public async saveMedication() {
    if (!this.isFormValid) return;

    // Merge strength into dosage for backend compatibility
    this.med.dosage = `${this.med.pillsPerDose} ${this.med.dosageUnit} (${this.med.strength})`;

    if (!this.med.startTime) this.extractStartTimeFromDate();
    if (this.med.startTime && this.med.intervalHours) this.med.reminderTimes = this.calculateReminderTimes();

    try {
      const cleanMed = JSON.parse(JSON.stringify(this.med));
      if (this.isEditMode && this.medication?.id) {
        if (this.prescriptionImage) cleanMed.prescriptionImageUrl = this.prescriptionImage;
        await this.medService.updateMedication(this.medication.id, cleanMed);
      } else {
        await this.medService.addMedication(cleanMed, this.prescriptionImage || undefined);
      }
      this.showToast(this.isEditMode ? 'Updated successfully!' : 'Saved successfully!', 'success');
      this.router.navigate(['/medication']);
    } catch (error) {
      this.showToast('Error saving medication.', 'danger');
    }
  }

  private calculateReminderTimes(): string[] {
    if (!this.med.startTime || !this.med.intervalHours) return [];
    const times: string[] = [];
    const [startHour, startMin] = this.med.startTime.split(':').map(Number);
    const intervalMs = Number(this.med.intervalHours) * 60 * 60 * 1000;
    let currentTime = new Date();
    currentTime.setHours(startHour, startMin, 0, 0);
    for (let i = 0; i < 5; i++) {
      if (currentTime.getHours() >= 24) break;
      times.push(`${String(currentTime.getHours()).padStart(2, '0')}:${String(currentTime.getMinutes()).padStart(2, '0')}`);
      currentTime.setTime(currentTime.getTime() + intervalMs);
    }
    return times;
  }

  public get amountLabel(): string {
    const types: any = { liquid: 'How many?', injection: 'How many?', inhaler: 'How many?', drops: 'How many?', cream: 'How many?' };
    return types[this.med.medicationType] || 'How many?';
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
  public dismiss() { this.router.navigate(['/tabs/medication']); }
  private extractStartTimeFromDate() { 
    this.med.startTime = new Date(this.med.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }); 
  }
  private async showToast(message: string, color: string = 'dark') {
    const toast = await this.toastController.create({ message, duration: 2000, position: 'bottom', color });
    await toast.present();
  }
}