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
}
