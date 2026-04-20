import { Component, Input } from '@angular/core';
import { PopoverController } from '@ionic/angular';

@Component({
  selector: 'app-user-menu-popover',
  template: `
    <ion-content class="user-menu-popover">
      <div class="user-info">
        <ion-avatar>
          <ion-icon name="person-circle" color="primary"></ion-icon>
        </ion-avatar>
        <div class="user-details">
          <h4>{{ userRole === 'nurse' ? 'Nurse' : 'Dr.' }} {{ doctorName }}</h4>
          <p>{{ doctorEmail }}</p>
          <ion-chip [color]="userRole === 'nurse' ? 'secondary' : 'primary'" size="small">
            <ion-label>{{ userRole === 'nurse' ? 'Nurse' : 'Doctor' }}</ion-label>
          </ion-chip>
        </div>
      </div>
      
      <ion-list lines="none">
        <ion-item button (click)="performAction('profile')">
          <ion-icon name="person-outline" slot="start"></ion-icon>
          <ion-label>Profile Settings</ion-label>
        </ion-item>
        
        <ion-item button (click)="performAction('preferences')">
          <ion-icon name="settings-outline" slot="start"></ion-icon>
          <ion-label>Preferences</ion-label>
        </ion-item>
        
        <ion-item button (click)="performAction('help')">
          <ion-icon name="help-circle-outline" slot="start"></ion-icon>
          <ion-label>Help & Support</ion-label>
        </ion-item>
        
        <ion-item button (click)="performAction('logout')" class="logout-item">
          <ion-icon name="log-out-outline" slot="start" color="danger"></ion-icon>
          <ion-label color="danger">Logout</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
  styles: [`
    .user-menu-popover {
      --padding-top: 0;
      --padding-bottom: 0;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      padding: 16px;
      background: var(--ion-color-light);
      border-bottom: 1px solid var(--ion-color-light-shade);
    }
    
    .user-info ion-avatar {
      margin-right: 12px;
      width: 48px;
      height: 48px;
    }
    
    .user-info ion-avatar ion-icon {
      font-size: 48px;
    }
    
    .user-details h4 {
      margin: 0 0 4px 0;
      font-weight: 600;
      color: var(--ion-color-dark);
    }
    
    .user-details p {
      margin: 0 0 8px 0;
      font-size: 14px;
      color: var(--ion-color-medium);
    }
    
    .logout-item {
      border-top: 1px solid var(--ion-color-light-shade);
      margin-top: 8px;
    }
    
    ion-list {
      padding: 8px 0;
    }
    
    ion-item {
      --padding-start: 16px;
      --padding-end: 16px;
    }
  `],
  standalone: false
})
export class UserMenuPopover {
  @Input() doctorName: string = '';
  @Input() doctorEmail: string = '';
  @Input() userRole: string = '';

  constructor(private popoverController: PopoverController) {}

  async performAction(action: string) {
    if (action === 'profile' || action === 'preferences' || action === 'help') {
      // For now, these are placeholder actions
      // In a full implementation, these would navigate to respective pages
      console.log(`${action} action selected`);
    }
    
    await this.popoverController.dismiss({
      action: action
    });
  }
}




