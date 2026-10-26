import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ProfileDetailService } from 'src/app/core';

@Component({
  selector: 'app-buddy-details-modal',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
  <div class="buddy-modal-backdrop" (click)="closeDetails.emit()">
  <section class="buddy-modal-content" role="dialog" aria-modal="true" aria-labelledby="buddy-details-title" (click)="$event.stopPropagation()">

    <ion-header>
      <ion-toolbar>
        <ion-title id="buddy-details-title">Buddy details</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" aria-label="Close buddy details" (click)="closeDetails.emit()">
            <ion-icon name="close-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div *ngIf="buddy" class="buddy-details-container">

        <div class="profile-section">
          <div class="avatar-container">
            <div class="buddy-avatar" aria-hidden="true">
              {{ buddy.firstName?.charAt(0) || buddy.fullName?.charAt(0) || '?' }}{{ buddy.lastName?.charAt(0) || '' }}
            </div>
          </div>

          <h2 class="buddy-name">
            {{ buddy.fullName || ((buddy.firstName || '') + ' ' + (buddy.lastName || '')).trim() || 'Unnamed Buddy' }}
          </h2>

          <div class="buddy-chips">
            <ion-chip *ngIf="buddy.buddyType" color="success" outline size="small">
              {{ buddy.buddyType | titlecase }}
            </ion-chip>

            <ion-chip *ngIf="buddy.status" [color]="buddy.status === 'accepted' ? 'success' : 'warning'" size="small">
              {{ buddy.status | titlecase }}
            </ion-chip>

            <ion-chip *ngIf="buddy.relationship" outline size="small">
              {{ buddy.relationship }}
            </ion-chip>
          </div>

          <p *ngIf="buddy.addedAt" class="added-date">
            Added {{ buddy.addedAt.toDate ? (buddy.addedAt.toDate() | date:'mediumDate') : (buddy.addedAt | date:'mediumDate') }}
          </p>
        </div>

        <div *ngIf="isLoadingContact" class="loading-contact" aria-live="polite">
          <ion-spinner name="crescent"></ion-spinner>
          <span>Loading contact details...</span>
        </div>

        <ion-card class="details-card">
          <ion-card-header>
            <ion-card-title>
              <ion-icon name="information-circle"></ion-icon>
              Contact Information
            </ion-card-title>
          </ion-card-header>

          <ion-card-content>
            <ion-list lines="none">

              <ion-item class="detail-item" *ngIf="buddy.email" lines="none">
                <ion-icon name="mail" slot="start"></ion-icon>
                <ion-label>
                  <h3>Email</h3>
                  <p>{{ buddy.email }}</p>
                </ion-label>
              </ion-item>

              <ion-item class="detail-item" lines="none">
                <ion-icon name="call" slot="start"></ion-icon>
                <ion-label>
                  <h3>Contact Number</h3>
                  <p>
                    {{ displayedContact || buddy.contactNumber || buddy.contact || (isLoadingContact ? 'Loading...' : 'Not provided') }}
                    <ion-badge
                      *ngIf="contactAutoPopulated"
                      color="success"
                      style="margin-left:6px;font-size:10px;">
                      From profile
                    </ion-badge>
                  </p>
                </ion-label>
              </ion-item>

              <ion-item class="detail-item" *ngIf="buddy.relationship" lines="none">
                <ion-icon name="heart" slot="start"></ion-icon>
                <ion-label>
                  <h3>Relationship</h3>
                  <p>{{ buddy.relationship }}</p>
                </ion-label>
              </ion-item>

              <ion-item class="detail-item" *ngIf="buddy.buddyType" lines="none">
                <ion-icon name="people" slot="start"></ion-icon>
                <ion-label>
                  <h3>Buddy type</h3>
                  <p>{{ buddy.buddyType | titlecase }}</p>
                </ion-label>
              </ion-item>

              <ion-item class="detail-item" *ngIf="buddy.addedAt" lines="none">
                <ion-icon name="calendar" slot="start"></ion-icon>
                <ion-label>
                  <h3>Date added</h3>
                  <p>
                    {{ buddy.addedAt.toDate ? (buddy.addedAt.toDate() | date:'mediumDate') : (buddy.addedAt | date:'mediumDate') }}
                  </p>
                </ion-label>
              </ion-item>

              <ion-item class="detail-item" *ngIf="buddy.fallbackContact?.name || buddy.fallbackContact?.phone" lines="none">
                <ion-icon name="person-add" slot="start"></ion-icon>
                <ion-label>
                  <h3>Emergency backup contact</h3>
                  <p>{{ buddy.fallbackContact?.name || 'No name' }}</p>
                  <p>{{ buddy.fallbackContact?.phone || 'No phone number' }}</p>
                </ion-label>
              </ion-item>

              <ion-item class="detail-item" *ngIf="buddy.fallbackContact?.customHotline" lines="none">
                <ion-icon name="call" slot="start"></ion-icon>
                <ion-label>
                  <h3>Custom hotline</h3>
                  <p>{{ buddy.fallbackContact.customHotline }}</p>
                </ion-label>
              </ion-item>

              <ion-item class="detail-item" *ngIf="buddy.enabledHotlines?.length" lines="none">
                <ion-icon name="medkit" slot="start"></ion-icon>
                <ion-label>
                  <h3>Emergency hotlines</h3>
                  <p *ngFor="let hotline of buddy.enabledHotlines">
                    {{ hotline.name }} — {{ hotline.number }}
                  </p>
                </ion-label>
              </ion-item>

            </ion-list>
          </ion-card-content>
        </ion-card>

        <div class="action-buttons" *ngIf="displayedContact || buddy.contactNumber || buddy.contact">
          <ion-button expand="block" class="call-btn" aria-label="Call buddy" (click)="callBuddy()">
            <ion-icon name="call" slot="start"></ion-icon>
            Call {{ buddy.firstName || buddy.fullName || 'Buddy' }}
          </ion-button>

          <ion-button expand="block" fill="outline" class="message-btn" aria-label="Text buddy" (click)="messageBuddy()">
            <ion-icon name="chatbubble" slot="start"></ion-icon>
            Send Message
          </ion-button>
        </div>

      </div>

      <div *ngIf="!buddy" class="no-buddy">
        <p>No buddy data available</p>
      </div>
    </ion-content>

  </section>
</div>        
  `,
  styles: [`
    :host { display: block; }
    .buddy-modal-backdrop {
      position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center;
      padding: 16px; background: rgba(12, 32, 29, 0.52); backdrop-filter: blur(3px);
    }
    .buddy-modal-content {
      width: min(100%, 520px); height: min(58vh, 500px); max-height: min(76vh, 620px); display: flex; flex-direction: column;
      overflow: hidden; border: 1px solid #e1ece9; border-radius: 24px; background: #f4f9f8;
      box-shadow: 0 22px 60px rgba(13, 38, 34, 0.26);
    }
    ion-header ion-toolbar { --background: #ffffff; --color: #173f39; --min-height: 46px; border-bottom: 1px solid #e5efed; }
    ion-title { font-size: 17px; font-weight: 800; }
    ion-header ion-button { --color: #55726c; min-width: 44px; min-height: 44px; }
    ion-content { --background: #f4f9f8; --padding-top: 10px; display: block; flex: 1 1 auto; min-height: 0; height: 100%; }
    .buddy-details-container { padding: 0 4px 8px; }
    .profile-section { text-align: center; margin: 0 0 8px; }
    .avatar-container { margin-bottom: 5px; }
    .buddy-avatar {
      width: 74px; height: 74px; margin: 0 auto; display: grid; place-items: center;
      border: 4px solid #ffffff; border-radius: 24px; background: #dff1ed; color: #036a5d;
      box-shadow: 0 5px 16px rgba(3, 106, 93, 0.12); font-size: 25px; font-weight: 850; text-transform: uppercase;
    }
    .buddy-name { margin: 0; color: #173f39; font-size: 22px; font-weight: 850; letter-spacing: -0.3px; }
    .buddy-chips { display: flex; justify-content: center; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
    .buddy-chips ion-chip { margin: 0; font-size: 11px; }
    .added-date { margin: 8px 0 0; color: #748984; font-size: 12px; }
    .loading-contact {
      display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 0 10px;
      color: #52726b; font-size: 12px;
    }
    .loading-contact ion-spinner { width: 17px; height: 17px; color: #036a5d; }
    .details-card {
      margin: 0; background: #ffffff; border: 1px solid #e2ecea; border-radius: 19px;
      box-shadow: 0 6px 18px rgba(20, 53, 47, 0.05);
    }
    .details-card ion-card-header { padding: 16px 16px 7px; }
    .details-card ion-card-title {
      display: flex; align-items: center; gap: 8px; color: #173f39; font-size: 15px; font-weight: 800;
    }
    .details-card ion-card-title ion-icon { color: #036a5d; font-size: 19px; }
    .details-card ion-card-content { padding: 0 12px 12px; }
    .details-card ion-list { padding: 0; background: transparent; }
    .detail-item {
      --background: #ffffff; --padding-start: 8px; --inner-padding-end: 8px; --min-height: 62px;
      margin-top: 4px; border-bottom: 1px solid #edf2f1;
    }
    .detail-item:last-child { border-bottom: 0; }
    .detail-item > ion-icon[slot="start"] { color: #43877c; font-size: 19px; margin-inline-end: 12px; }
    .detail-item ion-label h3 { margin: 0 0 4px; color: #70847f; font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: 0.35px; }
    .detail-item ion-label p { color: #173f39; font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; }
    .action-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 14px; }
    .action-buttons ion-button { min-height: 48px; margin: 0; --border-radius: 14px; font-size: 13px; font-weight: 750; }
    .call-btn { --background: #036a5d; --color: #ffffff; box-shadow: 0 6px 15px rgba(3, 106, 93, 0.16); }
    .message-btn { --color: #036a5d; --border-color: #b6d5ce; --background: #ffffff; }
    .no-buddy { padding: 40px 20px; color: #52726b; text-align: center; }
    @media (max-width: 400px) {
      .buddy-modal-content { height: min(62vh, 540px); max-height: 82vh; border-radius: 22px; }
      .action-buttons { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
  `]
})
export class BuddyDetailsModalComponent implements OnInit {
  @Input() buddy: any;
  @Output() closeDetails = new EventEmitter<void>();

  displayedContact = '';
  contactAutoPopulated = false;
  isLoadingContact = false;

  constructor(private profileDetailsService: ProfileDetailService) {}

  async ngOnInit() {
    if (this.buddy) {
      if (this.buddy.connectedUserId && !this.buddy.contactNumber && !this.buddy.contact) {
        await this.populateBuddyProfileContact();
      } else {
        this.displayedContact = this.buddy.contactNumber || this.buddy.contact || '';
      }
    }
  }

  async populateBuddyProfileContact() {
    try {
      this.isLoadingContact = true;
      const buddyProfileDetails = await this.profileDetailsService.getUserProfileDetails(this.buddy.connectedUserId);
      
      if (buddyProfileDetails?.phone) {
        this.displayedContact = buddyProfileDetails.phone;
        this.contactAutoPopulated = true;
      }
    } catch (error) {
      console.error('Error fetching buddy profile contact:', error);
    } finally {
      this.isLoadingContact = false;
    }
  }

  callBuddy() {
    const phoneNumber = this.displayedContact || this.buddy.contactNumber || this.buddy.contact;
    if (phoneNumber) {
      const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
      window.open(`tel:${cleanNumber}`, '_system');
    }
  }

  messageBuddy() {
    const phoneNumber = this.displayedContact || this.buddy.contactNumber || this.buddy.contact;
    if (phoneNumber) {
      const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
      window.open(`sms:${cleanNumber}`, '_system');
    }
  }
}
