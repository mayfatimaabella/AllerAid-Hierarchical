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
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ]
})
export class ManageAllergyCategoriesPage implements OnInit {

  /* 
     DATA
   */

  categories: AllergyCategory[] = [];

  filtered: AllergyCategory[] = [];

  isLoading = false;

  searchTerm = '';

  activeFilter: 'all' | 'active' | 'inactive' = 'all';


  /* 
     CATEGORY MODAL
   */

  isCategoryModalOpen = false;

  modalMode: 'add' | 'edit' = 'add';

  selectedCategory: AllergyCategory | null = null;


  /* 
     CATEGORY FORM
   */

  form = {
    name: '',
    order: 1,
    active: true
  };


  /* 
     SUMMARY COUNTS
   */

  get activeCategoryCount(): number {

    return this.categories.filter(
      category => this.isCategoryActive(category)
    ).length;

  }


  get inactiveCategoryCount(): number {

    return this.categories.filter(
      category => !this.isCategoryActive(category)
    ).length;

  }


  /* 
     CONSTRUCTOR
   */

  constructor(
    private categoryService: AdminAllergyCategoryService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}


  /* 
     LIFECYCLE
   */

  async ngOnInit(): Promise<void> {

    await this.loadCategories();

  }


  async ionViewWillEnter(): Promise<void> {

    await this.loadCategories();

  }


  /* 
     LOAD CATEGORIES
   */

  async loadCategories(): Promise<void> {

    try {

      this.isLoading = true;

      const data =
        await this.categoryService.getAllCategories();


      /*
       * Normalize active values.
       *
       * This protects the filter if the backend/database
       * returns true/false, 1/0, or "true"/"false".
       */

      this.categories = data.map(category => ({
        ...category,

        active: this.normalizeActiveValue(
          category.active
        )
      }));


      console.log(
        'Loaded categories:',
        this.categories
      );


      this.applyFilters();

    } catch (error) {

      console.error(
        'Load categories error:',
        error
      );

      await this.presentToast(
        'Failed to load categories.',
        'danger'
      );

    } finally {

      this.isLoading = false;

    }

  }


  /* 
     NORMALIZE ACTIVE VALUE
   */

  private normalizeActiveValue(
    value: unknown
  ): boolean {

    if (typeof value === 'boolean') {

      return value;

    }


    if (typeof value === 'number') {

      return value === 1;

    }


    if (typeof value === 'string') {

      const normalized =
        value.trim().toLowerCase();


      return (
        normalized === 'true' ||
        normalized === '1' ||
        normalized === 'active' ||
        normalized === 'yes'
      );

    }


    return false;

  }


  /* 
     CHECK CATEGORY STATUS
   */

  private isCategoryActive(
    category: AllergyCategory
  ): boolean {

    return this.normalizeActiveValue(
      category.active
    );

  }


  /* 
     FILTERING
   */

  setFilter(
    filter: 'all' | 'active' | 'inactive'
  ): void {

    this.activeFilter = filter;

    this.applyFilters();

  }


  filterCategories(): void {

    this.applyFilters();

  }


  private applyFilters(): void {

    let result = [
      ...this.categories
    ];


    /* 
       STATUS FILTER
     */

    if (this.activeFilter === 'active') {

      result = result.filter(
        category =>
          this.isCategoryActive(category)
      );

    }


    if (this.activeFilter === 'inactive') {

      result = result.filter(
        category =>
          !this.isCategoryActive(category)
      );

    }


    /* 
       SEARCH FILTER
     */

    const term =
      this.searchTerm
        .trim()
        .toLowerCase();


    if (term) {

      result = result.filter(
        category =>
          category.name
            .toLowerCase()
            .includes(term)
      );

    }


    /* 
       UPDATE DISPLAYED LIST
     */

    this.filtered = result;

  }


  /* 
     INITIALS
   */

  getInitials(name: string): string {

    return (
      name
        ?.trim()
        .slice(0, 2)
        .toUpperCase()
      || '??'
    );

  }


  /* 
     ADD CATEGORY
   */

  addCategory(): void {

    this.modalMode = 'add';

    this.selectedCategory = null;

    this.form = {
      name: '',
      order: this.categories.length + 1,
      active: true
    };

    this.isCategoryModalOpen = true;

  }


  /* 
     EDIT CATEGORY
   */

  editCategory(
    category: AllergyCategory
  ): void {

    this.modalMode = 'edit';

    this.selectedCategory = category;

    this.form = {
      name: category.name,
      order: category.order,
      active: this.isCategoryActive(category)
    };

    this.isCategoryModalOpen = true;

  }


  /* 
     CLOSE CATEGORY MODAL
   */

  closeCategoryModal(): void {

    this.isCategoryModalOpen = false;

    this.selectedCategory = null;

    this.form = {
      name: '',
      order: this.categories.length + 1,
      active: true
    };

  }


  /* 
     SAVE CATEGORY
   */

  async saveCategory(): Promise<void> {

    /* 
       VALIDATE NAME
     */

    const name =
      this.form.name
        ?.trim();


    if (!name) {

      await this.presentToast(
        'Category name is required.',
        'warning'
      );

      return;

    }


    /* 
       VALIDATE NAME LENGTH
     */

    if (name.length > 50) {

      await this.presentToast(
        'Category name must be 50 characters or less.',
        'warning'
      );

      return;

    }


    /* 
       VALIDATE ORDER
     */

    const order =
      Number(this.form.order);


    if (
      !Number.isInteger(order) ||
      order < 1
    ) {

      await this.presentToast(
        'Display order must be a whole number greater than 0.',
        'warning'
      );

      return;

    }


    /* 
       NORMALIZE STATUS
     */

    const active =
      Boolean(this.form.active);


    /* 
       ADD CATEGORY
     */

    if (this.modalMode === 'add') {

      try {

        await this.categoryService.addCategory({

          name,

          active,

          order

        });


        await this.presentToast(
          'Category added successfully.',
          'success'
        );


        this.closeCategoryModal();

        await this.loadCategories();

      } catch (error) {

        console.error(
          'Add category error:',
          error
        );

        await this.presentToast(
          'Failed to add category.',
          'danger'
        );

      }

      return;

    }


    /* 
       EDIT CATEGORY
     */

    if (
      this.modalMode === 'edit' &&
      this.selectedCategory
    ) {

      try {

        await this.categoryService.updateCategory(
          this.selectedCategory.id,
          {
            name,
            order,
            active
          }
        );


        await this.presentToast(
          'Category updated successfully.',
          'success'
        );


        this.closeCategoryModal();

        await this.loadCategories();

      } catch (error) {

        console.error(
          'Edit category error:',
          error
        );

        await this.presentToast(
          'Failed to update category.',
          'danger'
        );

      }

    }

  }


  /* 
     TOGGLE ACTIVE
   */

  async toggleActive(
    category: AllergyCategory
  ): Promise<void> {

    const current =
      this.isCategoryActive(category);


    const next =
      !current;


    const action =
      next
        ? 'activate'
        : 'deactivate';


    const alert =
      await this.alertController.create({

        header:
          next
            ? 'Activate Category?'
            : 'Deactivate Category?',

        message:
          `Are you sure you want to ${action} "${category.name}"?`,

        buttons: [

          {
            text: 'Cancel',
            role: 'cancel'
          },

          {
            text:
              next
                ? 'Activate'
                : 'Deactivate',

            role:
              next
                ? undefined
                : 'destructive',

            handler: async () => {

              try {

                await this.categoryService.updateCategory(
                  category.id,
                  {
                    active: next
                  }
                );


                await this.presentToast(

                  `Category ${
                    next
                      ? 'activated'
                      : 'deactivated'
                  }.`,

                  next
                    ? 'success'
                    : 'warning'

                );


                await this.loadCategories();

              } catch (error) {

                console.error(
                  'Toggle active error:',
                  error
                );


                await this.presentToast(
                  'Failed to update category.',
                  'danger'
                );

              }

            }

          }

        ]

      });


    await alert.present();

  }


  /* 
     DELETE CATEGORY
   */

  async deleteCategory(
    category: AllergyCategory
  ): Promise<void> {

    const alert =
      await this.alertController.create({

        header:
          'Delete Category?',

        message:
          `This will permanently remove "${category.name}". Allergy options using this category may be affected.`,

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

                await this.categoryService.deleteCategory(
                  category.id
                );


                await this.presentToast(
                  'Category deleted.',
                  'warning'
                );


                await this.loadCategories();

              } catch (error) {

                console.error(
                  'Delete category error:',
                  error
                );


                await this.presentToast(
                  'Failed to delete category.',
                  'danger'
                );

              }

            }

          }

        ]

      });


    await alert.present();

  }


  /* 
     TOAST
   */

  async presentToast(
    message: string,
    color: string = 'medium'
  ): Promise<void> {

    const toast =
      await this.toastController.create({

        message,

        duration: 2500,

        position: 'bottom',

        color

      });


    await toast.present();

  }

}
