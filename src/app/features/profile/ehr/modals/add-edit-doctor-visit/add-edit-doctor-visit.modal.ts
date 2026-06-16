import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { EHRService, DoctorVisit } from '../../../../../core/services/ehr.service';
import { UserService } from '../../../../../core/services/user.service';

@Component({
  selector: 'app-add-doctor-visit',
  templateUrl: './add-edit-doctor-visit.modal.html',
  styleUrls: ['./add-edit-doctor-visit.modal.scss'],
  standalone: false,
})
export class AddDoctorVisitModal implements OnInit {
  @Input() visit?: DoctorVisit;
  
  visitData: Omit<DoctorVisit, 'id' | 'patientId'> = {
    doctorName: '',
    doctorEmail: '',
    specialty: '',
    visitDate: new Date().toISOString(),
    chiefComplaint: '',
    diagnosis: '',
    notes: ''
  };

  isEditMode = false;
  isSaving = false;
  doctorInputMode: 'dropdown' | 'manual' = 'dropdown';
  availableDoctors: { name: string; specialty: string; email: string; }[] = [];
  selectedDoctorEmail = '';
  manualDoctorName = '';
  manualDoctorEmail = '';

 

  specialties = [
    'General Medicine',
    'Allergy & Immunology',
    'Cardiology',
    'Dermatology',
    'Emergency Medicine',
    'Endocrinology',
    'Family Medicine',
    'Internal Medicine',
    'Neurology',
    'Pediatrics',
    'Pulmonology',
    'Other'
  ];

  constructor(
    private modalCtrl: ModalController,
    private ehrService: EHRService,
    private userService: UserService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    
    await this.loadAvailableDoctors();
   
    this.doctorInputMode = 'dropdown';
    

    if (this.visit) {
      this.isEditMode = true;
      this.visitData = {
        doctorName: this.visit.doctorName,
        doctorEmail: this.visit.doctorEmail || '',
        specialty: this.visit.specialty,
        visitDate: this.visit.visitDate,
        chiefComplaint: this.visit.chiefComplaint,
        diagnosis: this.visit.diagnosis,
        notes: this.visit.notes || ''
      };
      
    
      const existingDoctor = this.availableDoctors.find(d => {
       
        if (this.visit?.doctorEmail) {
          return d.email === this.visit.doctorEmail;
        }
       
        return d.name === this.visit?.doctorName;
      });
      
      if (existingDoctor) {
        this.doctorInputMode = 'dropdown';
        this.selectedDoctorEmail = existingDoctor.email;
        
        if (!this.visitData.doctorEmail) {
          this.visitData.doctorEmail = existingDoctor.email;
        }
      } else {
        this.doctorInputMode = 'manual';
        this.manualDoctorName = this.visit.doctorName;
        this.manualDoctorEmail = this.visit.doctorEmail || '';
      }
    }
  }

  async loadAvailableDoctors() {
    try {
  
      const doctors = await this.userService.getDoctors();
      this.availableDoctors = doctors.map(doctor => ({
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        specialty: doctor.specialty || 'General Medicine',
        email: doctor.email
      }));
     
      this.availableDoctors.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error loading available doctors:', error);
      
      this.doctorInputMode = 'manual';
    }
  }

  switchInputMode(mode: 'dropdown' | 'manual') {
    this.doctorInputMode = mode;
    this.selectedDoctorEmail = '';
    this.manualDoctorName = '';
    this.visitData.doctorName = '';
    this.visitData.doctorEmail = '';
    this.visitData.specialty = '';
  }

  onDoctorSelection() {
    const selectedDoctor = this.availableDoctors.find(d => d.email === this.selectedDoctorEmail);
    if (selectedDoctor) {
      this.visitData.doctorName = selectedDoctor.name;
      this.visitData.doctorEmail = selectedDoctor.email;
      this.visitData.specialty = selectedDoctor.specialty;
    }
  }

  onManualDoctorInput() {
    this.visitData.doctorName = this.manualDoctorName;

    if (!this.manualDoctorEmail.trim()) {
      this.visitData.doctorEmail = '';
    }
  }

  onManualDoctorEmailInput() {
    this.visitData.doctorEmail = this.manualDoctorEmail.trim();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  async saveVisit() {
  if (this.isSaving) return;

  if (!this.visitData.doctorName.trim()) {
    this.presentToast('Please enter doctor name');
    return;
  }

  if (!this.visitData.visitDate) {
    this.presentToast('Please select visit date');
    return;
  }

  if (!this.visitData.chiefComplaint.trim()) {
    this.presentToast('Please enter chief complaint');
    return;
  }

  this.isSaving = true;

  try {
    console.log('Attempting to save visit data:', this.visitData);

    if (this.isEditMode && this.visit?.id) {
      console.log('Updating existing visit with ID:', this.visit.id);
      await this.ehrService.updateDoctorVisit(this.visit.id, this.visitData);
      await this.presentToast('Doctor visit updated successfully');
    } else {
      console.log('Adding new visit');
      await this.ehrService.addDoctorVisit(this.visitData);
      await this.presentToast('Doctor visit added successfully');
    }

    await this.modalCtrl.dismiss({ saved: true });
  } catch (error) {
    console.error('Detailed error saving doctor visit:', error);

    let errorMessage = 'Error saving doctor visit';
    if (error instanceof Error) {
      errorMessage += ': ' + error.message;
    }

    await this.presentToast(errorMessage);
  } finally {
    this.isSaving = false;
  }
}

  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }
}
