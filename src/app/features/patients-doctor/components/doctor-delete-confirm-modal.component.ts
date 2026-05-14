import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-doctor-delete-confirm-modal',
  templateUrl: './doctor-delete-confirm-modal.component.html',
  styleUrls: ['./doctor-delete-confirm-modal.component.scss'],
  standalone: false,
})
export class DoctorDeleteConfirmModalComponent {
  @Input() doctor: any;
  @Output() confirm = new EventEmitter<any>();
  @Output() cancelDelete = new EventEmitter<void>();

  isLoading = false;

  confirmDelete() {
    this.confirm.emit(this.doctor);
  }

  cancel() {
    this.cancelDelete.emit();
  }
}
