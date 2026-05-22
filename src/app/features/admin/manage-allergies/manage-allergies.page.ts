import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';

import { AdminAllergyService } from '../../../core/services/admin/admin-allergy';

@Component({
  selector: 'app-manage-allergies',
  templateUrl: './manage-allergies.page.html',
  styleUrls: ['./manage-allergies.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule
  ]
})
export class ManageAllergiesPage implements OnInit {

  allergyOptions: any[] = [];
  suggestions: any[] = [];

  isLoading = false;

  constructor(
    private adminAllergyService: AdminAllergyService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async ionViewWillEnter() {
    await this.loadData();
  }

  async loadData() {
    try {
      this.isLoading = true;

      this.allergyOptions =
        await this.adminAllergyService.getAllAllergyOptions();

      this.suggestions =
        await this.adminAllergyService.getAllergySuggestions();

    } catch (error) {
      console.error('Load allergy data error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async addAllergy() {
    const alert = await this.alertController.create({
      header: 'Add Allergy Option',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Example: Peanuts'
        },
        {
          name: 'category',
          type: 'text',
          placeholder: 'Example: Food, Medication, Environment'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Add',
          handler: async (data) => {
            const name = data.name?.trim();
            const category = data.category?.trim() || 'General';

            if (!name) {
              await this.presentToast('Allergy name is required.', 'warning');
              return false;
            }

            try {
              await this.adminAllergyService.addAllergyOption({
                name,
                label: name,
                value: name,
                category,
                isActive: true
              });

              await this.presentToast('Allergy option added.', 'success');
              await this.loadData();

              return true;
            } catch (error) {
              console.error('Add allergy error:', error);
              await this.presentToast('Failed to add allergy option.', 'danger');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async editAllergy(allergy: any) {
    const alert = await this.alertController.create({
      header: 'Edit Allergy Option',
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: allergy.name || allergy.label || '',
          placeholder: 'Allergy name'
        },
        {
          name: 'category',
          type: 'text',
          value: allergy.category || 'General',
          placeholder: 'Category'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Save',
          handler: async (data) => {
            const name = data.name?.trim();
            const category = data.category?.trim() || 'General';

            if (!name) {
              await this.presentToast('Allergy name is required.', 'warning');
              return false;
            }

            try {
              await this.adminAllergyService.updateAllergyOption(
                allergy.id,
                {
                  name,
                  label: name,
                  value: name,
                  category
                }
              );

              await this.presentToast('Allergy option updated.', 'success');
              await this.loadData();

              return true;
            } catch (error) {
              console.error('Edit allergy error:', error);
              await this.presentToast('Failed to update allergy option.', 'danger');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteAllergy(allergy: any) {
    const name = allergy.name || allergy.label || 'this allergy option';

    const alert = await this.alertController.create({
      header: 'Delete Allergy Option?',
      message: `Are you sure you want to delete ${name}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminAllergyService.deleteAllergyOption(allergy.id);
              await this.presentToast('Allergy option deleted.', 'warning');
              await this.loadData();
            } catch (error) {
              console.error('Delete allergy error:', error);
              await this.presentToast('Failed to delete allergy option.', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async approveSuggestion(suggestion: any) {
    try {
      await this.adminAllergyService.approveSuggestion(suggestion.id);
      await this.presentToast('Suggestion approved.', 'success');
      await this.loadData();
    } catch (error) {
      console.error(error);
      await this.presentToast('Failed to approve suggestion.', 'danger');
    }
  }

  async rejectSuggestion(suggestion: any) {
    try {
      await this.adminAllergyService.rejectSuggestion(suggestion.id);
      await this.presentToast('Suggestion rejected.', 'warning');
      await this.loadData();
    } catch (error) {
      console.error(error);
      await this.presentToast('Failed to reject suggestion.', 'danger');
    }
  }

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