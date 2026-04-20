import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-buddy-delete-confirm-modal',
  templateUrl: './buddy-delete-confirm-modal.component.html',
  styleUrls: ['./buddy-delete-confirm-modal.component.scss'],
  standalone: false,
})
export class BuddyDeleteConfirmModalComponent {
  @Input() buddy: any;
  @Output() confirm = new EventEmitter<any>();
  @Output() cancelDelete = new EventEmitter<void>();

  confirmDelete() {
    this.confirm.emit(this.buddy);
  }

  cancel() {
    this.cancelDelete.emit();
  }
}




