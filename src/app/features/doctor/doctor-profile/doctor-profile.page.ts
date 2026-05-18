import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastController, AlertController } from '@ionic/angular';
import { Subject } from 'rxjs';


@Component({
  selector: 'app-doctor-profile',
  templateUrl: './doctor-profile.page.html',
  styleUrls: ['./doctor-profile.page.scss'],
  standalone: false,
})
export class DoctorProfilePage implements OnInit, OnDestroy {
  doctorProfileForm!: FormGroup;
  isLoading: boolean = true;
  isEditing: boolean = false;
  selectedSegment: string = 'overview';
  doctorProfile: any;
  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    this.loadDoctorProfile();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeForm() {
    this.doctorProfileForm = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', Validators.required],
      specialization: ['', Validators.required],
      licenseNumber: ['', Validators.required],
      hospital: ['', Validators.required],
      bio: [''],
      profilePhoto: ['']
    });
  }

  loadDoctorProfile() {
    this.isLoading = true;
    // TODO: Implement doctor profile loading from service
    // this.doctorService.getDoctorProfile()
    //   .pipe(takeUntil(this.destroy$))
    //   .subscribe({
    //     next: (profile) => {
    //       this.doctorProfile = profile;
    //       this.populateForm(profile);
    //       this.isLoading = false;
    //     },
    //     error: (error) => {
    //       console.error('Error loading doctor profile:', error);
    //       this.showError('Failed to load profile');
    //       this.isLoading = false;
    //     }
    //   });
    this.isLoading = false;
  }

  populateForm(profile: any) {
    this.doctorProfileForm.patchValue({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      email: profile.email || '',
      phoneNumber: profile.phoneNumber || '',
      specialization: profile.specialization || '',
      licenseNumber: profile.licenseNumber || '',
      hospital: profile.hospital || '',
      bio: profile.bio || '',
      profilePhoto: profile.profilePhoto || ''
    });
  }

  toggleEditMode() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing) {
      this.resetForm();
    }
  }

  onSegmentChange(event: any) {
    this.selectedSegment = event.detail.value;
  }

  resetForm() {
    this.populateForm(this.doctorProfile);
  }

  saveDoctorProfile() {
    if (this.doctorProfileForm.invalid) {
      this.showError('Please fill in all required fields');
      return;
    }

    // TODO: Implement save profile to service
    // this.doctorService.updateDoctorProfile(this.doctorProfileForm.value)
    //   .pipe(takeUntil(this.destroy$))
    //   .subscribe({
    //     next: (response) => {
    //       this.doctorProfile = response;
    //       this.isEditing = false;
    //       this.showSuccess('Profile updated successfully');
    //     },
    //     error: (error) => {
    //       console.error('Error updating profile:', error);
    //       this.showError('Failed to update profile');
    //     }
    //   });

    this.isEditing = false;
    this.showSuccess('Profile updated successfully');
  }

  async showSuccess(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  async showError(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }
}
