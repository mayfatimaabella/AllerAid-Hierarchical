import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';

import {
  AdminAllergyCategoryService,
  AllergyCategory
} from '../../../core/services/admin/admin-allergy-category';

@Component({
  selector: 'app-manage-allergy-categories',
  templateUrl: './manage-allergy-categories.page.html',
  styleUrls: ['./manage-allergy-categories.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ManageAllergyCategoriesPage implements OnInit {

  categories: AllergyCategory[] = [];
  filtered: AllergyCategory[] = [];
  isLoading = false;
  searchTerm = '';
  activeFilter: 'all' | 'active' | 'inactive' = 'all';

  constructor(
    private categoryService: AdminAllergyCategoryService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadCategories();
  }

  async ionViewWillEnter() {
    await this.loadCategories();
  }

  async loadCategories() {
    try {
      this.isLoading = true;
      this.categories = await this.categoryService.getAllCategories();
      this.applyFilters();
    } catch (error) {
      console.error('Load categories error:', error);
      await this.presentToast('Failed to load categories.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  setFilter(filter: typeof this.activeFilter) {
    this.activeFilter = filter;
    this.applyFilters();
  }

  filterCategories() {
    this.applyFilters();
  }

  private applyFilters() {
    let result = [...this.categories];

    if (this.activeFilter === 'active') {
      result = result.filter(c => c.active === true);
    } else if (this.activeFilter === 'inactive') {
      result = result.filter(c => c.active === false);
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(c =>
        c.name.toLowerCase().includes(term)
      );
    }

    this.filtered = result;
  }

  getInitials(name: string): string {
    return name?.trim().slice(0, 2).toUpperCase() || '??';
  }

  // ─── ADD ─────────────────────────────────────────────────────────────────────

  async addCategory() {
    const alert = await this.alertController.create({
      header: 'Add Category',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Category name (e.g. Food)' },
        { name: 'order', type: 'number', placeholder: 'Display order (e.g. 1)', value: String(this.categories.length + 1) }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: async (data) => {
            const name = data.name?.trim();
            const order = parseInt(data.order, 10);

            if (!name) {
              await this.presentToast('Category name is required.', 'warning');
              return false;
            }

            try {
              await this.categoryService.addCategory({
                name,
                active: true,
                order: isNaN(order) ? this.categories.length + 1 : order
              });
              await this.presentToast('Category added.', 'success');
              await this.loadCategories();
              return true;
            } catch (error) {
              console.error('Add category error:', error);
              await this.presentToast('Failed to add category.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── EDIT ────────────────────────────────────────────────────────────────────

  async editCategory(category: AllergyCategory) {
    const alert = await this.alertController.create({
      header: 'Edit Category',
      inputs: [
        { name: 'name', type: 'text', value: category.name, placeholder: 'Category name' },
        { name: 'order', type: 'number', value: String(category.order), placeholder: 'Display order' }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const name = data.name?.trim();
            const order = parseInt(data.order, 10);

            if (!name) {
              await this.presentToast('Category name is required.', 'warning');
              return false;
            }

            try {
              await this.categoryService.updateCategory(category.id, {
                name,
                order: isNaN(order) ? category.order : order
              });
              await this.presentToast('Category updated.', 'success');
              await this.loadCategories();
              return true;
            } catch (error) {
              console.error('Edit category error:', error);
              await this.presentToast('Failed to update category.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── TOGGLE ACTIVE ───────────────────────────────────────────────────────────

  async toggleActive(category: AllergyCategory) {
    const next = !category.active;
    const action = next ? 'activate' : 'deactivate';

    const alert = await this.alertController.create({
      header: next ? 'Activate Category?' : 'Deactivate Category?',
      message: `Are you sure you want to ${action} "${category.name}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: next ? 'Activate' : 'Deactivate',
          handler: async () => {
            try {
              await this.categoryService.updateCategory(category.id, { active: next });
              await this.presentToast(
                `Category ${next ? 'activated' : 'deactivated'}.`,
                next ? 'success' : 'warning'
              );
              await this.loadCategories();
            } catch (error) {
              console.error('Toggle active error:', error);
              await this.presentToast('Failed to update category.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  async deleteCategory(category: AllergyCategory) {
    const alert = await this.alertController.create({
      header: 'Delete Category?',
      message: `This will permanently remove "${category.name}". Allergy options using this category may be affected.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.categoryService.deleteCategory(category.id);
              await this.presentToast('Category deleted.', 'warning');
              await this.loadCategories();
            } catch (error) {
              console.error('Delete category error:', error);
              await this.presentToast('Failed to delete category.', 'danger');
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
