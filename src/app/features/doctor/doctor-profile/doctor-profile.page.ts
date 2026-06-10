import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastController, AlertController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileDetailService } from '../../../core/services/profile-details.service';
import {
  getFirestore,
  collection,
  doc,
  setDoc
} from 'firebase/firestore';


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
    private userService: UserService,
    private authService: AuthService,
    private profileDetailService: ProfileDetailService
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

  async loadDoctorProfile() {
    this.isLoading = true;
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        const profile = await this.userService.getUserProfile(user.uid);
        if (profile) {
          this.doctorProfile = profile;
          this.populateForm(profile);
        } else {
          this.showError('Failed to load profile');
        }
      }
    } catch (error) {
      console.error('Error loading doctor profile:', error);
      this.showError('Failed to load profile');
    } finally {
      this.isLoading = false;
    }
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

  async saveDoctorProfile() {
    if (this.doctorProfileForm.invalid) {
      this.showError('Please fill in all required fields');
      return;
    }

    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        this.showError('User not authenticated');
        return;
      }

      const formValue = this.doctorProfileForm.value;
      
      // Update base user profile
      await this.userService.updateUserProfile(user.uid, {
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        email: formValue.email
      });

      // Update profile details (phone, profile picture)
      await this.profileDetailService.updateProfileDetails(user.uid, {
        phone: formValue.phoneNumber,
        profile_picture: formValue.profilePhoto
      });

      // Update professional credentials for doctors
      const db = getFirestore();
      await setDoc(
        doc(db, 'users', user.uid, 'professional', 'credentials'),
        {
          specialty: formValue.specialization,
          license: formValue.licenseNumber,
          hospital: formValue.hospital,
          bio: formValue.bio
        },
        { merge: true }
      );

      this.doctorProfile = { ...this.doctorProfile, ...formValue };
      this.isEditing = false;
      this.showSuccess('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      this.showError('Failed to update profile');
    }
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
