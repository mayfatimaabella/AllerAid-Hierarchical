import { Component, Input, Output, EventEmitter, OnInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { IonicModule, ModalController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-allergies-modal',
  templateUrl: './edit-allergies-modal.component.html',
  styleUrls: ['./edit-allergies-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class EditAllergiesModalComponent implements OnInit {

  @Input() mode: 'add' | 'edit' = 'edit';
  @Input() allergyOptions: any[] = [];
  @Output() refresh = new EventEmitter<(freshOptions: any[]) => void>();


  showRefreshHint = false;

  private originalState: string = '';
  private readonly HINT_KEY = 'allergy_refresh_hint_seen';

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Clone the input to avoid direct mutations
    if (this.allergyOptions && this.allergyOptions.length > 0) {
      this.allergyOptions = JSON.parse(JSON.stringify(this.allergyOptions));
    }

    // Store original state when modal opens
    this.originalState = JSON.stringify(
      this.allergyOptions.map(a => ({ name: a.name, checked: a.checked, value: a.value }))
    );

    // Show hint only if user hasn't seen it before
    this.showRefreshHint = !localStorage.getItem(this.HINT_KEY);
  }

  dismissHint() {
    this.showRefreshHint = false;
    localStorage.setItem(this.HINT_KEY, 'true');
  }

  async onRefresh(event: any) {
    this.dismissHint();

    try {
      await new Promise<void>((resolve) => {
        this.refresh.emit((freshOptions: any[]) => {
          this.allergyOptions = JSON.parse(JSON.stringify(freshOptions));
          this.originalState = JSON.stringify(
            this.allergyOptions.map(a => ({ name: a.name, checked: a.checked, value: a.value }))
          );
          this.cdr.detectChanges();
          resolve();
        });

        // Fallback if parent never calls back
        setTimeout(resolve, 3000);
      });
    } finally {
      event.target.complete();
    }
  }

  async onSave() {
    const invalidInput = this.allergyOptions.find(a =>
      a.checked && a.hasInput && !String(a.value || '').trim()
    );

    if (invalidInput) {
      const toast = await this.toastCtrl.create({
        message: `Please specify ${invalidInput.label}`,
        duration: 2000,
        position: 'bottom',
        color: 'warning',
        icon: 'alert-circle-outline'
      });
      await toast.present();
      return;
    }

    const currentState = JSON.stringify(
      this.allergyOptions.map(a => ({
        name: a.name,
        checked: a.checked,
        value: a.value || ''
      }))
    );

    const hasChanges = this.originalState !== currentState;

    if (!hasChanges) {
      const toast = await this.toastCtrl.create({
        message: 'No changes made',
        duration: 2000,
        position: 'bottom',
        color: 'medium',
        icon: 'information-circle-outline'
      });
      await toast.present();
      await this.modalCtrl.dismiss();
      return;
    }

    const clonedOptions = JSON.parse(JSON.stringify(this.allergyOptions));

    const toast = await this.toastCtrl.create({
      message: 'Allergies updated successfully!',
      duration: 2000,
      position: 'bottom',
      color: 'success',
      icon: 'checkmark-circle-outline'
    });
    await toast.present();

    await this.modalCtrl.dismiss({
      refresh: true,
      saved: true,
      allergyOptions: clonedOptions
    });
  }

  async onClose() {
    try {
      await this.ngZone.run(() => this.modalCtrl.dismiss());
    } catch (error) {
      console.error('Error dismissing modal:', error);
      this.ngZone.run(() => this.modalCtrl.dismiss().catch(() => {}));
    }
  }
}