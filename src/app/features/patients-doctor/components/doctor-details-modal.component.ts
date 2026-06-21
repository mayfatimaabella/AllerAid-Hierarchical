import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-doctor-details-modal',
  templateUrl: './doctor-details-modal.component.html',
  styleUrls: ['./doctor-details-modal.component.scss'],
  standalone: false,
})
export class DoctorDetailsModalComponent {
  @Input() doctor: any;
  @Output() closeDetails = new EventEmitter<void>();

  close() {
    this.closeDetails.emit();
  }

  convertTimestamp(timestamp: any): Date | null {
    if (!timestamp) return null;
    // Handle Firebase Timestamp objects
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    // Handle plain objects with seconds property
    if (timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }
    // Handle regular dates or timestamps
    return new Date(timestamp);
  }
}
