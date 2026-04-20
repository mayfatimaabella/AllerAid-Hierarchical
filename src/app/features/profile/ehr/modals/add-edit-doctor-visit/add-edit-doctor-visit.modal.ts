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
  doctorInputMode: 'dropdown' | 'manual' = 'dropdown';
  availableDoctors: { name: string; specialty: string; email: string; }[] = [];
  selectedDoctorEmail = '';
  manualDoctorName = '';
  manualDoctorEmail = '';

  // visitTypes removed in simplified model

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
    // Load available doctors from the system
    await this.loadAvailableDoctors();
    // Always default to registered doctor selection
    this.doctorInputMode = 'dropdown';
    
    // If editing an existing visit, populate the form
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
      
      // Check if the doctor is in our available doctors list (prioritize email matching)
      const existingDoctor = this.availableDoctors.find(d => {
        // First try to match by email if available
        if (this.visit?.doctorEmail) {
          return d.email === this.visit.doctorEmail;
        }
        // Fall back to name matching
        return d.name === this.visit?.doctorName;
      });
      
      if (existingDoctor) {
        this.doctorInputMode = 'dropdown';
        this.selectedDoctorEmail = existingDoctor.email;
        // Ensure email is set in visit data if it wasn't already
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
      // Get all users with doctor or nurse role
      const doctors = await this.userService.getDoctorsAndNurses();
      this.availableDoctors = doctors.map(doctor => ({
        name: `${doctor.role === 'doctor' ? 'Dr.' : 'Nurse'} ${doctor.firstName} ${doctor.lastName}`,
        specialty: doctor.specialty || 'General Medicine',
        email: doctor.email
      }));
      // Sort alphabetically for easier selection
      this.availableDoctors.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error loading available doctors:', error);
      // If we can't load doctors, default to manual input
      this.doctorInputMode = 'manual';
    }
  }

  switchInputMode(mode: 'dropdown' | 'manual') {
    this.doctorInputMode = mode;
    this.selectedDoctorEmail = '';
    this.manualDoctorName = '';
    this.visitData.doctorName = '';
    this.visitData.doctorEmail = ''; // Clear email when switching modes
    this.visitData.specialty = '';
  }

  onDoctorSelection() {
    const selectedDoctor = this.availableDoctors.find(d => d.email === this.selectedDoctorEmail);
    if (selectedDoctor) {
      this.visitData.doctorName = selectedDoctor.name;
      this.visitData.doctorEmail = selectedDoctor.email; // Store email for access control
      this.visitData.specialty = selectedDoctor.specialty;
    }
  }

  onManualDoctorInput() {
    this.visitData.doctorName = this.manualDoctorName;
    // Keep the email if manually entered, otherwise clear
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

    try {
      console.log('Attempting to save visit data:', this.visitData);
      
      if (this.isEditMode && this.visit?.id) {
        // Update existing visit
        console.log('Updating existing visit with ID:', this.visit.id);
        await this.ehrService.updateDoctorVisit(this.visit.id, this.visitData);
        this.presentToast('Doctor visit updated successfully');
      } else {
        // Add new visit
        console.log('Adding new visit');
        await this.ehrService.addDoctorVisit(this.visitData);
        this.presentToast('Doctor visit added successfully');
      }
      this.modalCtrl.dismiss({ saved: true });
    } catch (error) {
      console.error('Detailed error saving doctor visit:', error);
      let errorMessage = 'Error saving doctor visit';
      
      if (error instanceof Error) {
        errorMessage += ': ' + error.message;
      }
      
      this.presentToast(errorMessage);
    }
  }

  // Prescriptions removed in simplified model

  private async presentToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }
}
