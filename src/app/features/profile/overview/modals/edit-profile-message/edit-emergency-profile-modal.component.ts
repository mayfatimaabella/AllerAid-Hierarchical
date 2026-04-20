import { Component, Input, OnInit, Output, EventEmitter, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ModalController, IonicModule, AlertController, LoadingController, ToastController, IonTextarea } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-edit-emergency-profile-modal',
  templateUrl: './edit-emergency-profile-modal.component.html',
  styleUrls: ['./edit-emergency-profile-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule]
})
export class EditEmergencyProfileModalComponent implements OnInit, AfterViewInit {
  @Input() emergencyMessage: any;
  @Input() userProfile: any;
  @Input() mode: 'add' | 'edit' = 'edit';
  @Output() closeModal = new EventEmitter<void>();
  @Output() saveModal = new EventEmitter<any>();
  form!: FormGroup;
  minDate = '1900-01-01';
  maxDate = '';
  avatarPreview: string | null = null;
  readonly defaultAvatarUrl = 'https://ionicframework.com/docs/img/demos/avatar.svg';
  isUploadingAvatar: boolean = false;
  isSaving: boolean = false;
  private initialFormValue: any | null = null;

  @ViewChild('instructionsTextarea') instructionsTextarea?: IonTextarea;

  constructor(
    private modalCtrl: ModalController,
    private fb: FormBuilder,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private router: Router
  ) {}

  ngOnInit() {
    this.maxDate = new Date().toISOString().split('T')[0];

    this.form = this.fb.group({
      name: [this.emergencyMessage?.name || this.userProfile?.fullName || ''],
      allergies: [this.emergencyMessage?.allergies || ''],
      instructions: [this.emergencyMessage?.instructions || ''],
      location: [this.emergencyMessage?.location || ''],
      emergencyContactPhone: [this.userProfile?.emergencyContactPhone || ''],
      dateOfBirth: [this.userProfile?.dateOfBirth || ''],
      bloodType: [this.userProfile?.bloodType || ''],
      avatar: [this.userProfile?.avatar || '']
    });
    // Allergies are managed elsewhere; make field read-only in the editor
    this.form.get('allergies')?.disable({ emitEvent: false });
    this.avatarPreview = this.form.get('avatar')?.value || null;

    // Snapshot initial values for precise change detection (beyond Angular's pristine/dirty flags)
    this.initialFormValue = this.form.getRawValue();
  }

  ngAfterViewInit(): void {
    // Small delay to ensure the modal and textarea are fully rendered before focusing
    setTimeout(() => {
      this.instructionsTextarea?.setFocus();
    }, 0);
  }

  close() {
    this.closeModal.emit();
    this.modalCtrl.dismiss();
  }

  async save() {
    const phoneValue = (this.form.get('emergencyContactPhone')?.value || '').toString();
    if (phoneValue.length !== 11) {
      await this.presentToast('Emergency Contact Phone must be exactly 11 digits.', 'danger');
      return;
    }

    const dobValue = (this.form.get('dateOfBirth')?.value || '').toString();
    if (dobValue && !this.isValidDateOfBirth(dobValue)) {
      await this.presentToast(`Date of Birth must be between ${this.minDate} and ${this.maxDate}.`, 'danger');
      return;
    }

    // Ask for confirmation first
    const alert = await this.alertController.create({
      header: 'Confirm Save',
      message: 'Save changes to the emergency message?',
      cssClass: 'fixed-dark-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Save', role: 'confirm' }
      ]
    });
    await alert.present();
    const result = await alert.onDidDismiss();
    if (result.role !== 'confirm') {
      return;
    }

    // User confirmed: show a loading spinner while saving changes
    this.isSaving = true;
    const loading = await this.loadingController.create({
      message: 'Saving changes...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      // Use getRawValue to include disabled controls without allowing edits
      const formValues = this.form.getRawValue();

      // Check against initial snapshot so we only save when something actually changed
      if (this.initialFormValue && this.areFormValuesEqual(this.initialFormValue, formValues)) {
        await this.presentToast('You have not made any changes to your profile.', 'warning');
        return;
      }

      const updated = {
        ...this.emergencyMessage,
        ...formValues
      };
      this.saveModal.emit(updated);
      this.modalCtrl.dismiss(updated);
    } finally {
      this.isSaving = false;
      await loading.dismiss();
    }
  }

  /**
   * Shallow equality check for form values, normalizing undefined/null and trimming strings.
   */
  private areFormValuesEqual(a: any, b: any): boolean {
    const allKeys = new Set<string>([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const key of allKeys) {
      const av = this.normalizeValue(a ? a[key] : undefined);
      const bv = this.normalizeValue(b ? b[key] : undefined);
      if (av !== bv) {
        return false;
      }
    }
    return true;
  }

  private normalizeValue(value: any): any {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (value === undefined || value === null) {
      return '';
    }
    return value;
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'warning'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  get allergyLabels(): string[] {
    return this.getAllergyLabels();
  }

  getAllergyLabels(): string[] {
    const src: string = (this.emergencyMessage?.allergies || '').toString();
    return src
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  onPhoneInput(event: any): void {
    const rawValue = (event?.detail?.value || '').toString();
    const digitsOnly = rawValue.replace(/\D+/g, '').slice(0, 11);
    if (digitsOnly !== rawValue) {
      this.form.get('emergencyContactPhone')?.setValue(digitsOnly, { emitEvent: false });
    }
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    if (!this.userProfile?.uid) {
      const profileAlert = await this.alertController.create({
        header: 'Profile Missing',
        message: 'Unable to upload photo without a user profile.',
        cssClass: 'fixed-dark-alert',
        buttons: ['OK']
      });
      await profileAlert.present();
      input.value = '';
      return;
    }

    this.isUploadingAvatar = true;
    try {
      // Compress and store as data URL 
      const compressedDataUrl = await this.compressImageToDataUrl(file, 600, 0.75);
      this.avatarPreview = compressedDataUrl;
      this.form.get('avatar')?.setValue(compressedDataUrl, { emitEvent: false });
    } catch (error) {
      console.error('Avatar compression error:', error);
      const uploadAlert = await this.alertController.create({
        header: 'Processing Failed',
        message: 'Unable to process the photo. Please try again.',
        cssClass: 'fixed-dark-alert',
        buttons: ['OK']
      });
      await uploadAlert.present();
      this.avatarPreview = this.form.get('avatar')?.value || null;
    } finally {
      this.isUploadingAvatar = false;
      input.value = '';
    }
  }

  removeAvatar(): void {
    this.avatarPreview = null;
    this.form.get('avatar')?.setValue('', { emitEvent: false });
  }

  async goToBuddyTab(): Promise<void> {
    this.closeModal.emit();
    await this.modalCtrl.dismiss();
    await this.router.navigate(['/tabs/buddy']);
  }

  private async compressImageToDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
    const dataUrl = await this.readFileAsDataUrl(file);
    const img = await this.loadImage(dataUrl);

    let { width, height } = img;
    if (width > height) {
      if (width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      }
    } else if (height > maxSize) {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }


  private isValidDateOfBirth(dateValue: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return false;
    }

    const min = new Date(`${this.minDate}T00:00:00`);
    const max = new Date(`${this.maxDate}T23:59:59`);
    const selected = new Date(`${dateValue}T12:00:00`);

    if (Number.isNaN(selected.getTime())) {
      return false;
    }

    return selected >= min && selected <= max;
  }
}
