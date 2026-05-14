import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';

@Component({
  selector: 'app-doctor-edit-modal',
  templateUrl: './doctor-edit-modal.component.html',
  styleUrls: ['./doctor-edit-modal.component.scss'],
  standalone: false,
})
export class DoctorEditModalComponent implements OnInit {
  @Input() doctor: any;
  @Output() save = new EventEmitter<any>();
  @Output() closeEdit = new EventEmitter<void>();

  editForm: any = {};
  isLoading = false;

  ngOnInit() {
    if (this.doctor) {
      this.editForm = { ...this.doctor };
    }
  }

  saveChanges() {
    if (this.editForm.firstName && this.editForm.lastName) {
      this.save.emit(this.editForm);
    }
  }

  close() {
    this.closeEdit.emit();
  }
}
