import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, ModalController, AlertController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-patient-profile',
  templateUrl: './patient-profile.page.html',
  styleUrls: ['./patient-profile.page.scss'],
  standalone: false,
})
export class PatientProfilePage implements OnInit, OnDestroy {
  patientId: string = '';
  patient: any;
  isLoading: boolean = true;
  isEditing: boolean = false;
  selectedSegment: string = 'overview';
  private destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private toastController: ToastController,
    private modalController: ModalController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.patientId = this.activatedRoute.snapshot.paramMap.get('id') || '';
    if (this.patientId) {
      this.loadPatientProfile();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPatientProfile() {
    this.isLoading = true;
    // TODO: Implement patient profile loading from service
    // this.patientService.getPatientProfile(this.patientId)
    //   .pipe(takeUntil(this.destroy$))
    //   .subscribe({
    //     next: (patient) => {
    //       this.patient = patient;
    //       this.isLoading = false;
    //     },
    //     error: (error) => {
    //       console.error('Error loading patient profile:', error);
    //       this.isLoading = false;
    //       this.showToast('Failed to load patient profile', 'danger');
    //     }
    //   });
    
    // Mock data for development
    setTimeout(() => {
      this.patient = {
        id: this.patientId,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1 (555) 000-0000',
        dateOfBirth: '1990-01-15',
        avatar: 'assets/images/default-avatar.png',
        status: 'active',
        allergies: ['Peanuts', 'Shellfish', 'Tree Nuts'],
        medications: ['Epinephrine Auto-Injector', 'Antihistamine'],
        emergencyContacts: [
          { name: 'Jane Doe', relationship: 'Spouse', phone: '+1 (555) 000-0001' }
        ],
        lastVisit: '2026-05-01',
        nextAppointment: '2026-05-20'
      };
      this.isLoading = false;
    }, 500);
  }

  editProfile() {
    this.isEditing = true;
  }

  async saveProfile() {
    try {
      // TODO: Implement profile update through service
      this.showToast('Profile updated successfully', 'success');
      this.isEditing = false;
    } catch (error) {
      console.error('Error saving profile:', error);
      this.showToast('Failed to save profile', 'danger');
    }
  }

  cancelEdit() {
    this.isEditing = false;
    this.loadPatientProfile();
  }

  async sendMessage() {
    const alert = await this.alertController.create({
      header: 'Send Message',
      message: 'Send a message to the patient',
      inputs: [
        {
          name: 'message',
          type: 'textarea',
          placeholder: 'Type your message here...'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Send',
          handler: async (data) => {
            // TODO: Implement message sending
            this.showToast('Message sent successfully', 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  async scheduleAppointment() {
    // TODO: Navigate to appointment scheduling or open modal
    this.showToast('Appointment scheduling coming soon', 'info');
  }

  async viewMedicalHistory() {
    // TODO: Navigate to medical history or open modal
    this.showToast('Medical history feature coming soon', 'info');
  }

  async removePatient() {
    const alert = await this.alertController.create({
      header: 'Remove Patient',
      message: 'Are you sure you want to remove this patient? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Remove',
          role: 'destructive',
          handler: async () => {
            try {
              // TODO: Implement patient removal through service
              this.showToast('Patient removed successfully', 'success');
              setTimeout(() => {
                this.router.navigate(['/doctor-dashboard']);
              }, 1000);
            } catch (error) {
              console.error('Error removing patient:', error);
              this.showToast('Failed to remove patient', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async showToast(message: string, color: string = 'default') {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 2000,
      position: 'top',
    });
    await toast.present();
  }
}
