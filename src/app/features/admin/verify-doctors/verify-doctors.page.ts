import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';

import {
  AdminDoctorService,
  DoctorVerificationRequest
} from '../../../core/services/admin/admin-doctor';

@Component({
  selector: 'app-verify-doctors',
  templateUrl: './verify-doctors.page.html',
  styleUrls: ['./verify-doctors.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class VerifyDoctorsPage implements OnInit {

  pendingDoctors: DoctorVerificationRequest[] = [];
  isLoading = false;

  /** Tracks which doctor's doc panel is open (by uid). */
  private expandedDocs = new Set<string>();

  constructor(
    private adminDoctorService: AdminDoctorService,
    private alertController: AlertController,
    private toastController: ToastController,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    await this.loadPendingDoctors();
  }

  async ionViewWillEnter() {
    await this.loadPendingDoctors();
  }

  async loadPendingDoctors() {
    try {
      this.isLoading = true;
      this.expandedDocs.clear();
      this.pendingDoctors =
        await this.adminDoctorService.getPendingDoctorVerificationRequests();
    } catch (error) {
      console.error('Load pending doctors error:', error);
      await this.presentToast('Failed to load pending doctors.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // ─── Document preview helpers ───────────────────────────────────────────────

  toggleDocPreview(uid: string) {
    if (this.expandedDocs.has(uid)) {
      this.expandedDocs.delete(uid);
    } else {
      this.expandedDocs.add(uid);
    }
  }

  isDocExpanded(uid: string): boolean {
    return this.expandedDocs.has(uid);
  }

  /**
   * Returns 'Image', 'PDF', or 'Link' based on the URL.
   * Used in the template to decide which preview to render.
   */
  getLicenseType(url: string | undefined): 'Image' | 'PDF' | 'Link' {
    if (!url) return 'Link';
    const lower = url.toLowerCase().split('?')[0];
    if (/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) return 'Image';
    if (/\.pdf$/.test(lower)) return 'PDF';
    // Firebase Storage URLs for PDFs often contain %2F and end without extension
    if (lower.includes('application%2Fpdf') || lower.includes('/pdf')) return 'PDF';
    return 'Link';
  }

  /** Bypass Angular's security check so PDFs can load in <iframe>. */
  getSafeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /** Show a broken-image placeholder when a license image fails to load. */
  onDocImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const wrap = img.closest('.doc-img-wrap');
    if (wrap) {
      wrap.insertAdjacentHTML('afterend',
        `<div class="doc-no-preview">
           <ion-icon name="image-outline"></ion-icon>
           <p>Could not load image. <a href="${img.src}" target="_blank">Open directly.</a></p>
         </div>`
      );
    }
  }

  // ─── Avatar helper ───────────────────────────────────────────────────────────

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name
      .replace(/^Dr\.?\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  // ─── Approve / Reject ────────────────────────────────────────────────────────

  async approveDoctor(doctor: DoctorVerificationRequest) {
    const alert = await this.alertController.create({
      header: 'Approve doctor?',
      message: `Grant full access to ${doctor.fullName || doctor.email}?`,
      buttons: [
        {
          text: 'Approve',
          handler: async () => {
            try {
              await this.adminDoctorService.approveDoctor(doctor.uid);
              await this.presentToast('Doctor approved successfully.', 'success');
              await this.loadPendingDoctors();
            } catch (error) {
              console.error('Approve doctor error:', error);
              await this.presentToast('Failed to approve doctor.', 'danger');
            }
          }
        },
        { text: 'Cancel', role: 'cancel' },
      ]
    });
    await alert.present();
  }

  async rejectDoctor(doctor: DoctorVerificationRequest) {
    const alert = await this.alertController.create({
      header: 'Reject doctor?',
      message: `${doctor.fullName || doctor.email} will be notified.`,
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Reason for rejection (optional)'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reject',
          role: 'destructive',
          handler: async (data) => {
            try {
              await this.adminDoctorService.rejectDoctor(doctor.uid, data.reason);
              await this.presentToast('Doctor rejected.', 'warning');
              await this.loadPendingDoctors();
            } catch (error) {
              console.error('Reject doctor error:', error);
              await this.presentToast('Failed to reject doctor.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── Toast helper ────────────────────────────────────────────────────────────

  async presentToast(message: string, color: string = 'medium') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}