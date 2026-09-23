import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController, AlertController, LoadingController} from '@ionic/angular';
import { DoctorVisitService, DoctorVisit } from '../../../../../core/services/doctor-visit.service';
import { DoctorService } from '../../../../../core/services/doctor.service';
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

  availableDoctors: {
    name: string;
    specialty: string;
    email: string;
  }[] = [];

  selectedDoctorEmail = '';

  constructor(
    private modalCtrl: ModalController,
    private doctorVisitService: DoctorVisitService, 
    private userService: UserService,
    private doctorService: DoctorService,
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadAvailableDoctors();

    if (this.visit) {
      this.isEditMode = true;

      this.visitData = {
        doctorName: this.visit.doctorName,
        doctorEmail: this.visit.doctorEmail || '',
        specialty: this.visit.specialty || '',
        visitDate: this.visit.visitDate,
        chiefComplaint: this.visit.chiefComplaint,
        diagnosis: this.visit.diagnosis || '',
        notes: this.visit.notes || ''
      };

      // Doctor identification is based on email.
      const existingDoctor = this.availableDoctors.find(
        doctor => doctor.email === this.visit?.doctorEmail
      );

      if (existingDoctor) {
        // Existing doctor is still connected
        this.selectedDoctorEmail = existingDoctor.email;

        this.visitData.doctorName = existingDoctor.name;
        this.visitData.doctorEmail = existingDoctor.email;
        this.visitData.specialty = existingDoctor.specialty;
      } else {
        // Doctor is no longer connected.
        // Keep the information stored on the existing visit.
        this.visitData.doctorName = this.visit.doctorName;
        this.visitData.doctorEmail = this.visit.doctorEmail || '';
        this.visitData.specialty = this.visit.specialty || '';
        this.selectedDoctorEmail = this.visit.doctorEmail || '';
      }
    }
  }

  /**
   * Loads doctors connected to the current patient.
   * Only doctors with a valid email are included because
   * doctorEmail is the identification system for doctor visits.
   */
  async loadAvailableDoctors(): Promise<void> {
    try {
      const currentUser =
        await this.userService.getCurrentUserProfile();

      if (!currentUser?.uid) {
        this.availableDoctors = [];
        return;
      }

      const connectedDoctors =
        await this.doctorService.getUserDoctors(currentUser.uid);

      this.availableDoctors = connectedDoctors
        .filter((doctor: any) => !!doctor?.doctorEmail)
        .map((doctor: any) => ({
          name:
            doctor.doctorName ||
            `Dr. ${doctor.doctorEmail}`,
          specialty:
            doctor.specialization ||
            doctor.specialty ||
            'General Medicine',
          email: doctor.doctorEmail
        }));

      // Remove duplicate doctors based on email.
      const uniqueDoctors = new Map<
        string,
        {
          name: string;
          specialty: string;
          email: string;
        }
      >();

      this.availableDoctors.forEach(doctor => {
        uniqueDoctors.set(doctor.email, doctor);
      });

      this.availableDoctors = Array.from(
        uniqueDoctors.values()
      );

      // Sort alphabetically by doctor name.
      this.availableDoctors.sort((a, b) =>
        a.name.localeCompare(b.name)
      );

    } catch (error) {
      console.error(
        'Error loading available doctors:',
        error
      );

      this.availableDoctors = [];

      await this.presentToast(
        'Unable to load connected doctors'
      );
    }
  }

  /**
   * Called when the patient selects a connected doctor.
   * Doctor name, email, and specialty are populated
   * automatically from the doctor's profile.
   */
  onDoctorSelection(): void {
    const selectedDoctor =
      this.availableDoctors.find(
        doctor =>
          doctor.email === this.selectedDoctorEmail
      );

    if (!selectedDoctor) {
      this.visitData.doctorName = '';
      this.visitData.doctorEmail = '';
      this.visitData.specialty = '';
      return;
    }

    this.visitData.doctorName = selectedDoctor.name;
    this.visitData.doctorEmail = selectedDoctor.email;
    this.visitData.specialty = selectedDoctor.specialty;
  }

  dismiss(): void {
    this.modalCtrl.dismiss();
  }

async saveVisit(): Promise<void> {
  if (this.isSaving) {
    return;
  }

  let selectedDoctor;

  if (this.selectedDoctorEmail) {
    selectedDoctor = this.availableDoctors.find(
      doctor => doctor.email === this.selectedDoctorEmail
    );
  }

  if (!this.isEditMode && !selectedDoctor) {
    await this.presentToast('Please select a doctor');
    return;
  }

  if (selectedDoctor) {
    this.visitData.doctorName = selectedDoctor.name;
    this.visitData.doctorEmail = selectedDoctor.email;
    this.visitData.specialty = selectedDoctor.specialty;
  }

  if (!this.visitData.visitDate) {
    await this.presentToast('Please select visit date');
    return;
  }

  if (!this.visitData.chiefComplaint.trim()) {
    await this.presentToast('Please enter reason for visit');
    return;
  }

  this.isSaving = true;

  const loading = await this.showLoading(
    this.isEditMode
      ? 'Updating doctor visit...'
      : 'Saving doctor visit...'
  );

  try {

    // EDIT
    if (this.isEditMode && this.visit?.id) {

      await this.doctorVisitService.updateDoctorVisit(
        this.visit.id,
        this.visitData
      );

      await loading.dismiss();

      await this.presentToast(
        'Doctor visit updated successfully'
      );

      await this.modalCtrl.dismiss({
        saved: true
      });

      return;
    }

    // ADD
    const possibleDuplicates =
      await this.doctorVisitService.addDoctorVisit(
        this.visitData
      );

    await loading.dismiss();

    // No duplicate
    if (possibleDuplicates.length === 0) {

      await this.presentToast(
        'Doctor visit added successfully'
      );

      await this.modalCtrl.dismiss({
        saved: true
      });

      return;
    }

    // Duplicate found
    this.isSaving = false;

    await this.showDuplicateWarning(
      possibleDuplicates
    );

  } catch (error) {

    await loading.dismiss();

    console.error(
      'Error saving doctor visit:',
      error
    );

    let errorMessage =
      'Error saving doctor visit';

    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }

    await this.presentToast(errorMessage);

  } finally {
    this.isSaving = false;
  }
}



  private async presentToast(
    message: string
  ): Promise<void> {
    const toast =
      await this.toastController.create({
        message,
        duration: 2000,
        position: 'bottom'
      });

    await toast.present();
  }

private async showDuplicateWarning(
  duplicates: DoctorVisit[]
): Promise<void> {

  const duplicate = duplicates[0];

  const doctorName =
    duplicate.doctorName || 'this doctor';

  const date =
    this.formatVisitDate(duplicate.visitDate);

  const reason =
    duplicate.chiefComplaint || 'No reason recorded';

  const alert =
    await this.alertController.create({
      header: 'Possible Duplicate Visit',

      message:
        `You already have a visit recorded with ` +
        `${doctorName} on ${date}.\n\n` +
        `Reason: ${reason}\n\n` +
        `This could be a separate medical encounter. ` +
        `Do you want to save this visit anyway?`,

      buttons: [
        {
          text: 'Save Anyway',
          handler: async () => {

            try {

              this.isSaving = true;

              await this.doctorVisitService.addDoctorVisit(
                this.visitData,
                true
              );

              await this.presentToast(
                'Doctor visit added successfully'
              );

              await this.modalCtrl.dismiss({
                saved: true
              });

            } catch (error) {

              console.error(
                'Error saving duplicate visit:',
                error
              );

              await this.presentToast(
                'Failed to save doctor visit'
              );

            } finally {
              this.isSaving = false;
            }
          }
        },
                {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });

  await alert.present();
}


private formatVisitDate(
  visitDate: string
): string {

  if (!visitDate) {
    return 'Unknown date';
  }

  const date = new Date(visitDate);

  if (isNaN(date.getTime())) {
    return visitDate;
  }

  return date.toLocaleDateString(
    'en-US',
    {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }
  );
}

private async showLoading(message = 'Saving...'): Promise<HTMLIonLoadingElement> {
  const loading = await this.loadingController.create({
    message,
    spinner: 'crescent',
    backdropDismiss: false
  });

  await loading.present();

  return loading;
}



}


