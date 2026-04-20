import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-buddy-actions-modal',
  templateUrl: './buddy-actions-modal.component.html',
  styleUrls: ['./buddy-actions-modal.component.scss'],
  standalone: false,
})
export class BuddyActionsModalComponent {
  @Input() buddy: any;
  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() closeModal = new EventEmitter<void>();

  editBuddy() {
    this.edit.emit(this.buddy);
  }

  deleteBuddy() {
    this.delete.emit(this.buddy);
  }

  close() {
    this.closeModal.emit();
  }
}




