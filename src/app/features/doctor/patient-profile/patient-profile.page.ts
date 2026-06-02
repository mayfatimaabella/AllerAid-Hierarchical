import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, ModalController } from '@ionic/angular';
import { combineLatest, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

import { UserProfile } from 'src/app/core/services/models/user-profile.model';
import { Medication } from 'src/app/core/services/medication.service';

@Component({
  selector: 'app-patient-profile',
  templateUrl: './patient-profile.page.html',
  styleUrls: ['./patient-profile.page.scss'],
  standalone: false,
})
export class PatientProfilePage implements OnInit, OnDestroy {
  patientId: string = '';
  selectedTab: string = 'overview';
  isLoading: boolean = true;

  // Patient data
  patient: any;
  patientAllergies: any[] = [];
  patientMedications: Medication[] = [];
  patientEHR: any = {};
  patientProfileDetails: any = {};

  private destroy$ = new Subject<void>();

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private toastController: ToastController,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    this.patientId = this.activatedRoute.snapshot.paramMap.get('id') || '';
    if (this.patientId) {
      this.loadPatientProfile();
    } else {
      this.showToast('Patient ID not found', 'danger');
      this.router.navigate(['/doctor-dashboard']);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPatientProfile() {
    this.isLoading = true;
    // TODO: Replace with actual service calls
    // Implement service methods:
    // - patientService.getPatientProfile(this.patientId)
    // - patientService.getPatientAllergies(this.patientId)
    // - patientService.getPatientMedications(this.patientId)
    // - patientService.getPatientEHR(this.patientId)
    
    // Mock data for development
    setTimeout(() => {
      
    }, 500);
  }

  selectTab(tab: string) {
    this.selectedTab = tab;
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

  // Navigation actions
  sendMessage() {
    this.showToast('Message sending feature coming soon', 'info');
  }

  scheduleAppointment() {
    this.showToast('Appointment scheduling coming soon', 'info');
  }

  viewMedicalHistory() {
    this.showToast('Detailed medical history coming soon', 'info');
  }

  goBack() {
    this.router.navigate(['/doctor-dashboard']);
  }
}
