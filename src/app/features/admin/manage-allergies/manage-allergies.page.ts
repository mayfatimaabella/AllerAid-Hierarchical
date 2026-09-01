import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
    IonicModule,
    FormsModule
  ]
})
export class ManageAllergiesPage implements OnInit {

  allergyOptions: any[] = [];
  suggestions: any[] = [];
  categories: any[] = [];

  isLoading = false;

  activeTab: 'options' | 'suggestions' = 'options';

  // Allergy modal
  isAllergyModalOpen = false;
  isEditingAllergy = false;
  editingAllergyId: string | null = null;

  allergyForm = {
    name: '',
    categoryId: ''
  };

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

  // ─────────────────────────────────────────────
  // LOAD DATA
  // ─────────────────────────────────────────────

  async loadData() {
    try {
      this.isLoading = true;

      // This service method already returns active categories
      this.categories =
        await this.adminAllergyService.getAllergyCategories();

      const categoryMap = new Map(
        this.categories.map(category => [
          category.id,
          category.name
        ])
      );

      this.allergyOptions =
        await this.adminAllergyService.getAllAllergyOptions();

      this.allergyOptions =
        this.allergyOptions.map(allergy => ({
          ...allergy,
          categoryName:
            categoryMap.get(allergy.categoryId) ||
            allergy.categoryName ||
            'Uncategorized'
        }));

      this.suggestions =
        await this.adminAllergyService.getAllergySuggestions();

    } catch (error) {

      console.error('Load allergy data error:', error);

      await this.presentToast(
        'Failed to load allergy data.',
        'danger'
      );

    } finally {
      this.isLoading = false;
    }
  }

  // ─────────────────────────────────────────────
  // CATEGORY CLASS
  // ─────────────────────────────────────────────

  getCategoryClass(category: string): string {

    const c = (category || '').toLowerCase();

    if (c === 'food') return 'food';
    if (c === 'medication') return 'medication';
    if (c === 'environment') return 'environment';

    return 'general';
  }

  // ─────────────────────────────────────────────
  // ADD ALLERGY
  // ─────────────────────────────────────────────

  async addAllergy() {

    if (this.categories.length === 0) {

      await this.presentToast(
        'No active allergy categories are available. Please add a category first.',
        'warning'
      );

      return;
    }

    this.isEditingAllergy = false;
    this.editingAllergyId = null;

    this.allergyForm = {
      name: '',
      categoryId: ''
    };

    this.isAllergyModalOpen = true;
  }

  // ─────────────────────────────────────────────
  // EDIT ALLERGY
  // ─────────────────────────────────────────────

  async editAllergy(allergy: any) {

    if (this.categories.length === 0) {

      await this.presentToast(
        'No active allergy categories are available.',
        'warning'
      );

      return;
    }

    this.isEditingAllergy = true;
    this.editingAllergyId = allergy.id;

    this.allergyForm = {
      name: allergy.name || allergy.label || '',
      categoryId: allergy.categoryId || ''
    };

    this.isAllergyModalOpen = true;
  }

  // ─────────────────────────────────────────────
  // CLOSE MODAL
  // ─────────────────────────────────────────────

  closeAllergyModal() {

    this.isAllergyModalOpen = false;

    this.isEditingAllergy = false;
    this.editingAllergyId = null;

    this.allergyForm = {
      name: '',
      categoryId: ''
    };
  }

  // ─────────────────────────────────────────────
  // SAVE ALLERGY
  // ─────────────────────────────────────────────

  async saveAllergy() {

    const name = this.allergyForm.name.trim();
    const categoryId = this.allergyForm.categoryId;

    if (!name) {

      await this.presentToast(
        'Allergy name is required.',
        'warning'
      );

      return;
    }

    if (!categoryId) {

      await this.presentToast(
        'Please select an allergy category.',
        'warning'
      );

      return;
    }

    const selectedCategory =
      this.categories.find(
        category => category.id === categoryId
      );

    if (!selectedCategory) {

      await this.presentToast(
        'Selected category is invalid.',
        'danger'
      );

      return;
    }

    try {

      const data = {
        name,
        label: name,
        value: name,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        isActive: true
      };

      if (this.isEditingAllergy && this.editingAllergyId) {

        await this.adminAllergyService.updateAllergyOption(
          this.editingAllergyId,
          data
        );

        await this.presentToast(
          'Allergy option updated.',
          'success'
        );

      } else {

        await this.adminAllergyService.addAllergyOption(
          data
        );

        await this.presentToast(
          'Allergy option added.',
          'success'
        );
      }

      this.closeAllergyModal();

      await this.loadData();

    } catch (error) {

      console.error('Save allergy error:', error);

      await this.presentToast(
        this.isEditingAllergy
          ? 'Failed to update allergy option.'
          : 'Failed to add allergy option.',
        'danger'
      );
    }
  }

  // ─────────────────────────────────────────────
  // DELETE ALLERGY
  // ─────────────────────────────────────────────

  async deleteAllergy(allergy: any) {

    const name =
      allergy.name ||
      allergy.label ||
      'this allergy option';

    const alert = await this.alertController.create({

      header: 'Delete Allergy Option?',

      message:
        `Are you sure you want to delete "${name}"?`,

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

              await this.adminAllergyService
                .deleteAllergyOption(allergy.id);

              await this.presentToast(
                'Allergy option deleted.',
                'warning'
              );

              await this.loadData();

            } catch (error) {

              console.error(
                'Delete allergy error:',
                error
              );

              await this.presentToast(
                'Failed to delete allergy option.',
                'danger'
              );
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // ─────────────────────────────────────────────
  // APPROVE SUGGESTION
  // ─────────────────────────────────────────────

  async approveSuggestion(suggestion: any) {

    const categories =
      await this.adminAllergyService.getAllergyCategories();

    if (categories.length === 0) {

      await this.presentToast(
        'No active allergy categories are available.',
        'warning'
      );

      return;
    }

    const alert = await this.alertController.create({

      header: 'Approve Suggestion',

      message:
        `Choose category for "${
          suggestion.label || suggestion.name
        }"`,

      inputs: categories.map(category => ({
        type: 'radio',
        name: 'categoryId',
        label: category.name,
        value: category.id
      })),

      buttons: [

        {
          text: 'Cancel',
          role: 'cancel'
        },

        {
          text: 'Approve',

          handler: async (categoryId) => {

            if (!categoryId) {

              await this.presentToast(
                'Please select a category.',
                'warning'
              );

              return false;
            }

            try {

              await this.adminAllergyService
                .approveSuggestion(
                  suggestion.id,
                  categoryId
                );

              await this.presentToast(
                'Suggestion approved.',
                'success'
              );

              await this.loadData();

              return true;

            } catch (error) {

              console.error(error);

              await this.presentToast(
                'Failed to approve suggestion.',
                'danger'
              );

              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // ─────────────────────────────────────────────
  // REJECT SUGGESTION
  // ─────────────────────────────────────────────

  async rejectSuggestion(suggestion: any) {

    try {

      await this.adminAllergyService
        .rejectSuggestion(suggestion.id);

      await this.presentToast(
        'Suggestion rejected.',
        'warning'
      );

      await this.loadData();

    } catch (error) {

      console.error(error);

      await this.presentToast(
        'Failed to reject suggestion.',
        'danger'
      );
    }
  }

  // ─────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────

  async presentToast(
    message: string,
    color: string = 'medium'
  ) {

    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });

    await toast.present();
  }
}