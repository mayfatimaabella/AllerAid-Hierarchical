import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';

import {
  AdminUserService,
  AdminUser
} from '../../../core/services/admin/admin-user';

@Component({
  selector: 'app-manage-users',
  templateUrl: './manage-users.page.html',
  styleUrls: ['./manage-users.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ManageUsersPage implements OnInit {

  users: AdminUser[] = [];
  filtered: AdminUser[] = [];
  isLoading = false;
  searchTerm = '';
  activeFilter: 'all' | 'user' | 'doctor' | 'admin' = 'all';

  constructor(
    private adminUserService: AdminUserService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadUsers();
  }

  async ionViewWillEnter() {
    await this.loadUsers();
  }

  async loadUsers() {
    try {
      this.isLoading = true;
      this.users = await this.adminUserService.getAllUsers();
      this.applyFilters();
    } catch (error) {
      console.error('Load users error:', error);
      await this.presentToast('Failed to load users.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  setFilter(filter: typeof this.activeFilter) {
    this.activeFilter = filter;
    this.applyFilters();
  }

  filterUsers() {
    this.applyFilters();
  }

  private applyFilters() {
    let result = [...this.users];

    if (this.activeFilter !== 'all') {
      result = result.filter(u => u.role === this.activeFilter);
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter(u =>
        this.getDisplayName(u).toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term)
      );
    }

    this.filtered = result;
  }

  getDisplayName(user: AdminUser): string {
    if (user.fullName) return user.fullName;
    if (user.firstName || user.lastName)
      return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return user.email || 'Unnamed User';
  }

  getInitials(user: AdminUser): string {
    const name = this.getDisplayName(user);
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase();
  }

  roleBadgeColor(role?: string): string {
    if (role === 'admin') return 'danger';
    if (role === 'doctor') return 'tertiary';
    return 'primary';
  }

  // ─── ADD ─────────────────────────────────────────────────────────────────────

  async addUser() {
    const alert = await this.alertController.create({
      header: 'Add User',
      inputs: [
        {
          name: 'firstName',
          type: 'text',
          placeholder: 'First name *'
        },
        {
          name: 'lastName',
          type: 'text',
          placeholder: 'Last name'
        },
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email *'
        },
        {
          name: 'phone',
          type: 'tel',
          placeholder: 'Phone number'
        },
        {
          name: 'role',
          type: 'text',
          value: 'user',
          placeholder: 'Role: user | doctor | admin'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: async (data) => {
            const firstName = data.firstName?.trim();
            const lastName  = data.lastName?.trim();
            const email     = data.email?.trim();
            const phone     = data.phone?.trim();
            const rawRole   = data.role?.trim();
            const role      = (['user', 'doctor', 'admin'].includes(rawRole)
              ? rawRole
              : 'user') as AdminUser['role'];

            if (!firstName) {
              await this.presentToast('First name is required.', 'warning');
              return false;
            }
            if (!email) {
              await this.presentToast('Email is required.', 'warning');
              return false;
            }

            try {
              await this.adminUserService.createUser({
                firstName,
                lastName,
                fullName: `${firstName} ${lastName}`.trim(),
                email,
                phone,
                role
              });
              await this.presentToast('User created successfully.', 'success');
              await this.loadUsers();
              return true;
            } catch (error) {
              console.error('Add user error:', error);
              await this.presentToast('Failed to create user.', 'danger');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // ─── EDIT ────────────────────────────────────────────────────────────────────

  async editUser(user: AdminUser) {
    const alert = await this.alertController.create({
      header: 'Edit User',
      inputs: [
        {
          name: 'firstName',
          type: 'text',
          value: user.firstName || '',
          placeholder: 'First name'
        },
        {
          name: 'lastName',
          type: 'text',
          value: user.lastName || '',
          placeholder: 'Last name'
        },
        {
          name: 'phone',
          type: 'tel',
          value: user.phone || '',
          placeholder: 'Phone number'
        },
        {
          name: 'role',
          type: 'text',
          value: user.role || 'user',
          placeholder: 'Role: user | doctor | admin'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const firstName = data.firstName?.trim();
            const lastName = data.lastName?.trim();
            const phone = data.phone?.trim();
            const rawRole = data.role?.trim();
            const role = (['user', 'doctor', 'admin'].includes(rawRole)
              ? rawRole
              : user.role) as AdminUser['role'];

            if (!firstName) {
              await this.presentToast('First name is required.', 'warning');
              return false;
            }

            try {
              await this.adminUserService.updateUser(user.uid, {
                firstName,
                lastName,
                fullName: `${firstName} ${lastName}`.trim(),
                phone,
                role
              });
              await this.presentToast('User updated successfully.', 'success');
              await this.loadUsers();
              return true;
            } catch (error) {
              console.error('Edit user error:', error);
              await this.presentToast('Failed to update user.', 'danger');
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // ─── SUSPEND / RESTORE ───────────────────────────────────────────────────────

  async toggleActive(user: AdminUser) {
    const isSuspended = user.isActive === false;
    const action = isSuspended ? 'restore' : 'suspend';
    const name = this.getDisplayName(user);

    const alert = await this.alertController.create({
      header: isSuspended ? 'Restore User?' : 'Suspend User?',
      message: `Are you sure you want to ${action} ${name}?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: isSuspended ? 'Restore' : 'Suspend',
          handler: async () => {
            try {
              if (isSuspended) {
                await this.adminUserService.activateUser(user.uid);
              } else {
                await this.adminUserService.deactivateUser(user.uid);
              }
              await this.presentToast(
                `User ${isSuspended ? 'restored' : 'suspended'}.`,
                isSuspended ? 'success' : 'warning'
              );
              await this.loadUsers();
            } catch (error) {
              console.error('Toggle active error:', error);
              await this.presentToast('Failed to update user status.', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────────

  async deleteUser(user: AdminUser) {
    const name = this.getDisplayName(user);

    const alert = await this.alertController.create({
      header: 'Delete User?',
      message: `This will permanently remove ${name}. This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.adminUserService.deleteUser(user.uid);
              await this.presentToast('User deleted.', 'warning');
              await this.loadUsers();
            } catch (error) {
              console.error('Delete user error:', error);
              await this.presentToast('Failed to delete user.', 'danger');
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