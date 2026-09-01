import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController,ToastController} from '@ionic/angular';
import { AdminUserService, AdminUser } from '../../../core/services/admin/admin-user';


@Component({
  selector: 'app-manage-users',
  templateUrl: './manage-users.page.html',
  styleUrls: ['./manage-users.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ]
})
export class ManageUsersPage implements OnInit {

  users: AdminUser[] = [];

  filtered: AdminUser[] = [];

  isLoading = false;

  searchTerm = '';

  activeFilter:
    'all' | 'user' | 'doctor' | 'admin' = 'all';

  isUserModalOpen = false;

  modalMode: 'add' | 'edit' = 'add';

  editingUser: AdminUser | null = null;

  phoneHasInvalidCharacters = false;

  form = {

    firstName: '',

    lastName: '',

    email: '',

    phone: '',

    password: '',

    role: 'user' as
      'user' | 'doctor' | 'admin'

  };

  constructor(
    private adminUserService: AdminUserService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit(): Promise<void> {

    await this.loadUsers();

  }


  async ionViewWillEnter(): Promise<void> {

    await this.loadUsers();

  }

  async loadUsers(): Promise<void> {

    try {

      this.isLoading = true;

      this.users =
        await this.adminUserService.getAllUsers();

      this.applyFilters();

    } catch (error) {

      console.error(
        'Load users error:',
        error
      );

      await this.presentToast(
        'Failed to load users.',
        'danger'
      );

    } finally {

      this.isLoading = false;

    }

  }

  setFilter(
    filter:
      'all' | 'user' | 'doctor' | 'admin'
  ): void {

    this.activeFilter = filter;

    this.applyFilters();

  }


  filterUsers(): void {

    this.applyFilters();

  }


  private applyFilters(): void {

    let result = [...this.users];


    if (this.activeFilter !== 'all') {

      result = result.filter(
        user =>
          this.getUserRole(user) ===
          this.activeFilter
      );

    }

    const term =
      this.searchTerm
        .trim()
        .toLowerCase();


    if (term) {

      result = result.filter(user => {

        const name =
          this.getDisplayName(user)
            .toLowerCase();

        const email =
          (user.email || '')
            .toLowerCase();

        return (
          name.includes(term) ||
          email.includes(term)
        );

      });

    }


    this.filtered = result;

  }

  getDisplayName(
    user: AdminUser
  ): string {

    if (user.fullName) {

      return user.fullName;

    }


    if (
      user.firstName ||
      user.lastName
    ) {

      return (
        `${user.firstName ?? ''} ` +
        `${user.lastName ?? ''}`
      ).trim();

    }


    return user.email ||
      'Unnamed User';

  }


  getInitials(
    user: AdminUser
  ): string {

    const name =
      this.getDisplayName(user);


    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(
        word =>
          word.charAt(0)
      )
      .join('')
      .toUpperCase();

  }

  getUserRole(
    user: AdminUser
  ): 'user' | 'doctor' | 'admin' {

    if (
      user.role === 'admin' ||
      user.role === 'doctor' ||
      user.role === 'user'
    ) {

      return user.role;

    }


    return 'user';

  }


  roleBadgeColor(
    role?: string
  ): string {

    if (role === 'admin') {

      return 'danger';

    }


    if (role === 'doctor') {

      return 'tertiary';

    }


    return 'primary';

  }

  addUser(): void {

    this.phoneHasInvalidCharacters = false;
    this.modalMode = 'add';

    this.editingUser = null;


    this.form = {

      firstName: '',

      lastName: '',

      email: '',

      phone: '',

      password: '',

      role: 'user'

    };


    this.isUserModalOpen = true;

  }

  editUser(
    user: AdminUser
  ): void {

    this.phoneHasInvalidCharacters = false;

    this.modalMode = 'edit';

    this.editingUser = user;


    this.form = {

      firstName:
        user.firstName || '',

      lastName:
        user.lastName || '',

      email:
        user.email || '',

      phone:
        user.phone || '',

      /*
       * Password is intentionally empty
       * when editing.
       *
       * We do NOT store or retrieve
       * Firebase passwords.
       */

      password: '',

      role:
        this.getUserRole(user)

    };


    this.isUserModalOpen = true;

  }


  closeUserModal(): void {

    this.phoneHasInvalidCharacters = false;

    this.isUserModalOpen = false;

    this.editingUser = null;


    this.form = {

      firstName: '',

      lastName: '',

      email: '',

      phone: '',

      password: '',

      role: 'user'

    };

  }

sanitizePhone(event: any): void {
  const inputValue = event?.detail?.value ?? '';

  // Detect letters or other invalid characters BEFORE sanitizing
  this.phoneHasInvalidCharacters = /[^0-9+]/.test(inputValue);

  let value = inputValue.replace(/[^0-9+]/g, '');

  // Keep + only at the beginning
  if (value.includes('+')) {
    value = '+' + value.replace(/\+/g, '');
  }

  // International Philippine format: +639XXXXXXXXX
  if (value.startsWith('+')) {
    if (value.startsWith('+63')) {
      value = '+63' + value.substring(3).replace(/\D/g, '');
    } else {
      value = '+63' + value.substring(1).replace(/\D/g, '');
    }

    value = value.substring(0, 13);
  } else {
    // Local Philippine format: 09XXXXXXXXX
    value = value.replace(/\D/g, '').substring(0, 11);
  }

  this.form.phone = value;
}

  async saveUser(): Promise<void> {

    const firstName = this.form.firstName.trim();
    const lastName = this.form.lastName.trim();
    const email = this.form.email.trim().toLowerCase();
    const phone = this.form.phone.trim();
    const phoneHasInvalidCharacters = this.phoneHasInvalidCharacters;
    const password = this.form.password.trim();
    const role = this.form.role;

    if (!firstName) {
      await this.presentToast(
        'First name is required.',
        'warning'
      );
      return;
    }

    if (firstName.length > 50) {
      await this.presentToast(
        'First name cannot exceed 50 characters.',
        'warning'
      );
      return;
    }

    if (!/^[A-Za-zÀ-ÿ' -]+$/.test(firstName)) {
      await this.presentToast(
        'First name can only contain letters, spaces, hyphens, and apostrophes.',
        'warning'
      );
      return;
    }

    if (lastName.length > 50) {
      await this.presentToast(
        'Last name cannot exceed 50 characters.',
        'warning'
      );
      return;
    }

    if (
      lastName &&
      !/^[A-Za-zÀ-ÿ' -]+$/.test(lastName)
    ) {
      await this.presentToast(
        'Last name can only contain letters, spaces, hyphens, and apostrophes.',
        'warning'
      );
      return;
    }

    if (!email) {
      await this.presentToast(
        'Email is required.',
        'warning'
      );
      return;
    }

    if (email.length > 100) {
      await this.presentToast(
        'Email cannot exceed 100 characters.',
        'warning'
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      await this.presentToast(
        'Please enter a valid email address.',
        'warning'
      );
      return;
    }

  if (phoneHasInvalidCharacters) {
    await this.presentToast(
      'Phone number can only contain numbers.',
      'warning'
    );
    return;
  }

  if (phone) {

    const validPhone =
      /^(09\d{9}|\+639\d{9})$/.test(phone);

    if (!validPhone) {
      await this.presentToast(
        'Enter a valid Philippine phone number: 09XXXXXXXXX or +639XXXXXXXXX.',
        'warning'
      );
      return;
    }

  }

    if (
      role !== 'user' &&
      role !== 'doctor' &&
      role !== 'admin'
    ) {
      await this.presentToast(
        'Please select a valid role.',
        'warning'
      );
      return;
    }
    if (this.modalMode === 'add') {

      if (!password) {
        await this.presentToast(
          'Password is required.',
          'warning'
        );
        return;
      }

      if (password.length < 8) {
        await this.presentToast(
          'Password must be at least 8 characters.',
          'warning'
        );
        return;
      }

      if (password.length > 64) {
        await this.presentToast(
          'Password cannot exceed 64 characters.',
          'warning'
        );
        return;
      }

      if (!/[A-Z]/.test(password)) {
        await this.presentToast(
          'Password must contain at least one uppercase letter.',
          'warning'
        );
        return;
      }

      if (!/[a-z]/.test(password)) {
        await this.presentToast(
          'Password must contain at least one lowercase letter.',
          'warning'
        );
        return;
      }

      if (!/\d/.test(password)) {
        await this.presentToast(
          'Password must contain at least one number.',
          'warning'
        );
        return;
      }

    }
    try {

      if (this.modalMode === 'add') {

        await this.adminUserService.createUser({

          firstName,

          lastName,

          fullName:
            `${firstName} ${lastName}`.trim(),

          email,

          phone,

          password,

          role

        });

        await this.presentToast(
          'User account created successfully.',
          'success'
        );
      }
      else if (
        this.modalMode === 'edit' &&
        this.editingUser
      ) {

        await this.adminUserService.updateUser(
          this.editingUser.uid,
          {
            firstName,
            lastName,
            fullName:
              `${firstName} ${lastName}`.trim(),
            phone,
            role
          }
        );

        await this.presentToast(
          'User updated successfully.',
          'success'
        );
      }

      this.closeUserModal();

      await this.loadUsers();

    } catch (error: any) {

      console.error(
        'Save user error:',
        error
      );

      let message =
        this.modalMode === 'add'
          ? 'Failed to create user.'
          : 'Failed to update user.';

      if (error?.message) {
        message = error.message;
      }

      await this.presentToast(
        message,
        'danger'
      );
    }
  }

  async toggleActive(
    user: AdminUser
  ): Promise<void> {

    const isSuspended =
      user.isActive === false;


    const action =
      isSuspended
        ? 'restore'
        : 'suspend';


    const name =
      this.getDisplayName(user);


    const alert =
      await this.alertController.create({

        header:
          isSuspended
            ? 'Restore User?'
            : 'Suspend User?',

        message:
          `Are you sure you want to ` +
          `${action} ${name}?`,

        buttons: [

          {
            text: 'Cancel',
            role: 'cancel'
          },

          {

            text:
              isSuspended
                ? 'Restore'
                : 'Suspend',

            handler: async () => {

              try {

                if (isSuspended) {

                  await this.adminUserService
                    .activateUser(
                      user.uid
                    );

                } else {

                  await this.adminUserService
                    .deactivateUser(
                      user.uid
                    );

                }


                await this.presentToast(

                  `User ${
                    isSuspended
                      ? 'restored'
                      : 'suspended'
                  }.`,
                  
                  isSuspended
                    ? 'success'
                    : 'warning'

                );


                await this.loadUsers();


              } catch (error) {

                console.error(
                  'Toggle active error:',
                  error
                );


                await this.presentToast(
                  'Failed to update user status.',
                  'danger'
                );

              }

            }

          }

        ]

      });


    await alert.present();

  }

  async deleteUser(
    user: AdminUser
  ): Promise<void> {

    const name =
      this.getDisplayName(user);


    const alert =
      await this.alertController.create({

        header: 'Delete User?',

        message:
          `This will permanently remove ` +
          `${name}. This cannot be undone.`,

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

                await this.adminUserService
                  .deleteUser(
                    user.uid
                  );


                await this.presentToast(
                  'User deleted.',
                  'warning'
                );


                await this.loadUsers();


              } catch (error) {

                console.error(
                  'Delete user error:',
                  error
                );


                await this.presentToast(
                  'Failed to delete user.',
                  'danger'
                );

              }

            }

          }

        ]

      });


    await alert.present();

  }


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