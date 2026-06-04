import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';

import {
  AdminEmergencyHotlineService,
  EmergencyHotline
} from '../../../core/services/admin/admin-emergency-hotline';

@Component({
  selector: 'app-manage-emergency-hotlines',
  templateUrl: './manage-emergency-hotlines.page.html',
  styleUrls: ['./manage-emergency-hotlines.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ManageEmergencyHotlinesPage implements OnInit {

  hotlines: EmergencyHotline[] = [];
  filtered: EmergencyHotline[] = [];
  isLoading = false;
  searchTerm = '';
  activeFilter: 'all' | 'active' | 'inactive' = 'all';

  constructor(
    private hotlineService: AdminEmergencyHotlineService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadHotlines();
  }

  async ionViewWillEnter() {
    await this.loadHotlines();
  }

  async loadHotlines() {
    try {
      this.isLoading = true;
      this.hotlines = await this.hotlineService.getAllHotlines();
      this.applyFilters();
    } catch (error) {
      console.error('Load hotlines error:', error);
      await this.presentToast('Failed to load hotlines.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  setFilter(filter: typeof this.activeFilter) {
    this.activeFilter = filter;
    this.applyFilters();
  }

  filterHotlines() {
    this.applyFilters();
  }

  private applyFilters() {
    let result = [...this.hotlines];

    if (this.activeFilter === 'active') {
      result = result.filter(h => h.isActive === true);
    } else if (this.activeFilter === 'inactive') {
      result = result.filter(h => h.isActive === false);
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(h =>
        h.name.toLowerCase().includes(term) ||
        h.number.toLowerCase().includes(term)
      );
    }

    this.filtered = result;
  }

  getInitials(name: string): string {
    return name
      ?.split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase() || '??';
  }

  // ─── ADD ─────────────────────────────────────────────────────────────────────

  async addHotline() {
    const alert = await this.alertController.create({
      header: 'Add Hotline',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Organization name (e.g. Red Cross PH)' },
        { name: 'number', type: 'tel', placeholder: 'Hotline number (e.g. 143)' },
        { name: 'order', type: 'number', placeholder: 'Display order', value: String(this.hotlines.length + 1) }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: async (data) => {
            const name = data.name?.trim();
            const number = data.number?.trim();
            const order = parseInt(data.order, 10);

            if (!name || !number) {
              await this.presentToast('Name and number are required.', 'warning');
              return false;
            }

            try {
              await this.hotlineService.addHotline({
                name,
                number,
                isActive: true,
                defaultEnabled: false,
                order: isNaN(order) ? this.hotlines.length + 1 : order
              });
              await this.presentToast('Hotline added.', 'success');
              await this.loadHotlines();
              return true;
            } catch (error) {
              console.error('Add hotline error:', error);
              await this.presentToast('Failed to add hotline.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── EDIT ────────────────────────────────────────────────────────────────────

  async editHotline(hotline: EmergencyHotline) {
    const alert = await this.alertController.create({
      header: 'Edit Hotline',
      inputs: [
        { name: 'name', type: 'text', value: hotline.name, placeholder: 'Organization name' },
        { name: 'number', type: 'tel', value: hotline.number, placeholder: 'Hotline number' },
        { name: 'order', type: 'number', value: String(hotline.order), placeholder: 'Display order' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const name = data.name?.trim();
            const number = data.number?.trim();
            const order = parseInt(data.order, 10);

            if (!name || !number) {
              await this.presentToast('Name and number are required.', 'warning');
              return false;
            }

            try {
              await this.hotlineService.updateHotline(hotline.id, {
                name,
                number,
                order: isNaN(order) ? hotline.order : order
              });
              await this.presentToast('Hotline updated.', 'success');
              await this.loadHotlines();
              return true;
            } catch (error) {
              console.error('Edit hotline error:', error);
              await this.presentToast('Failed to update hotline.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── TOGGLE ACTIVE ───────────────────────────────────────────────────────────

  async toggleActive(hotline: EmergencyHotline) {
    const next = !hotline.isActive;
    const alert = await this.alertController.create({
      header: next ? 'Activate Hotline?' : 'Deactivate Hotline?',
      message: `Are you sure you want to ${next ? 'activate' : 'deactivate'} "${hotline.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: next ? 'Activate' : 'Deactivate',
          handler: async () => {
            try {
              await this.hotlineService.updateHotline(hotline.id, { isActive: next });
              await this.presentToast(
                `Hotline ${next ? 'activated' : 'deactivated'}.`,
                next ? 'success' : 'warning'
              );
              await this.loadHotlines();
            } catch (error) {
              console.error('Toggle active error:', error);
              await this.presentToast('Failed to update hotline.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── TOGGLE DEFAULT ENABLED ──────────────────────────────────────────────────

  async toggleDefaultEnabled(hotline: EmergencyHotline) {
    try {
      await this.hotlineService.updateHotline(hotline.id, {
        defaultEnabled: !hotline.defaultEnabled
      });
      await this.presentToast(
        `Default ${!hotline.defaultEnabled ? 'enabled' : 'disabled'} for "${hotline.name}".`,
        'success'
      );
      await this.loadHotlines();
    } catch (error) {
      console.error('Toggle default enabled error:', error);
      await this.presentToast('Failed to update hotline.', 'danger');
    }
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  async deleteHotline(hotline: EmergencyHotline) {
    const alert = await this.alertController.create({
      header: 'Delete Hotline?',
      message: `This will permanently remove "${hotline.name} (${hotline.number})".`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.hotlineService.deleteHotline(hotline.id);
              await this.presentToast('Hotline deleted.', 'warning');
              await this.loadHotlines();
            } catch (error) {
              console.error('Delete hotline error:', error);
              await this.presentToast('Failed to delete hotline.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── TOAST ───────────────────────────────────────────────────────────────────

  async presentToast(message: string, color: string = 'medium') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}
