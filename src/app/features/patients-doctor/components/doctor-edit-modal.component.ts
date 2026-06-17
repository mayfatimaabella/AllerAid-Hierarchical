import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-doctor-edit-modal',
  templateUrl: './doctor-edit-modal.component.html',
  styleUrls: ['./doctor-edit-modal.component.scss'],
  standalone: false,
})
export class DoctorEditModalComponent implements OnInit, OnChanges {
  @Input() doctor: any;
  @Output() save = new EventEmitter<any>();
  @Output() closeEdit = new EventEmitter<void>();

  editForm: any = {};
  isLoading = false;

  ngOnInit() {
    this.populateForm();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['doctor'] && !changes['doctor'].firstChange) {
      this.populateForm();
    }
  }

  private populateForm() {
    if (this.doctor) {
      this.editForm = {
        firstName: this.doctor.firstName || '',
        lastName: this.doctor.lastName || '',
        specialty: this.doctor.specialty || '',
        email: this.doctor.email || '',
        phone: this.doctor.phone || ''
      };
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
