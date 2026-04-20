import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-ehr-access-management-card',
  templateUrl: './ehr-access-management-card.component.html',
  styleUrls: ['./ehr-access-management-card.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class EhrAccessManagementCardComponent {
  @Input() ehrAccessList: string[] = [];
  @Input() newProviderEmail: string = '';
  @Input() newProviderName: string = '';
  @Input() newProviderRole: string = '';
  @Input() newProviderLicense: string = '';
  @Input() newProviderSpecialty: string = '';
  @Input() newProviderHospital: string = '';

  @Output() sendAccessRequest = new EventEmitter<void>();
  @Output() revokeAccess = new EventEmitter<string>();

  sendAccessRequestHandler() {
    this.sendAccessRequest.emit();
  }

  revokeEHRAccessHandler(provider: string) {
    this.revokeAccess.emit(provider);
  }
}
