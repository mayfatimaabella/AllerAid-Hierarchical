import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-doctor-actions-modal',
  templateUrl: './doctor-actions-modal.component.html',
  styleUrls: ['./doctor-actions-modal.component.scss'],
  standalone: false,
})
export class DoctorActionsModalComponent {
  @Input() doctor: any;
  @Output() delete = new EventEmitter<any>();
  @Output() closeModal = new EventEmitter<void>();

  deleteDoctor() {
    this.delete.emit(this.doctor);
  }

  close() {
    this.closeModal.emit();
  }
}
