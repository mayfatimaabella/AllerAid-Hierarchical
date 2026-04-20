import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-buddy-edit-modal',
  templateUrl: './buddy-edit-modal.component.html',
  styleUrls: ['./buddy-edit-modal.component.scss'],
  standalone: false,
})
export class BuddyEditModalComponent implements OnInit {
  @Input() buddy: any;
  @Output() save = new EventEmitter<any>();
  @Output() closeEdit = new EventEmitter<void>();

  editFirstName = '';
  editLastName = '';
  editEmail = '';
  editRelationship = '';
  editContact = '';
  buddyProfileContact = ''; // Emergency contact from buddy's profile
  isLoadingContact = false;
  contactAutoPopulated = false; // Flag to show if contact was auto-populated

  constructor(private userService: UserService) {}

  async ngOnInit() {
    if (this.buddy) {
      this.editFirstName = this.buddy.firstName;
      this.editLastName = this.buddy.lastName;
      this.editEmail = this.buddy.email || '';
      this.editContact = this.buddy.contactNumber || this.buddy.contact || '';
      
      // Try to auto-populate contact from buddy's profile if not already set
      if (this.buddy.connectedUserId && !this.editContact) {
        await this.populateBuddyProfileContact();
      }
    }
  }

  async populateBuddyProfileContact() {
    try {
      this.isLoadingContact = true;
      const buddyProfile = await this.userService.getUserProfile(this.buddy.connectedUserId);
      
      if (buddyProfile && buddyProfile.emergencyContactPhone) {
        this.buddyProfileContact = buddyProfile.emergencyContactPhone;
        this.editContact = buddyProfile.emergencyContactPhone;
        this.contactAutoPopulated = true;
      }
    } catch (error) {
      console.error('Error fetching buddy profile contact:', error);
      // Silently fail - contact field just stays empty
    } finally {
      this.isLoadingContact = false;
    }
  }

  saveEdit() {
    this.save.emit({
      ...this.buddy,
      firstName: this.editFirstName,
      lastName: this.editLastName,
      email: this.editEmail,
      relationship: this.editRelationship,
      contactNumber: this.editContact,
      contact: this.editContact // Keep both for backward compatibility
    });
  }

  close() {
    this.closeEdit.emit();
  }
}




