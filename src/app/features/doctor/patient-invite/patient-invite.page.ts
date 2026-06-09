import { Component, OnInit } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { DoctorService, DoctorInvitation } from '../../../core/services/doctor.service';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-patient-invite',
  templateUrl: './patient-invite.page.html',
  styleUrls: ['./patient-invite.page.scss'],
  standalone: false,
})
export class PatientInvitePage implements OnInit {
  currentUserId = '';
  receivedInvitations: DoctorInvitation[] = [];

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private doctorService: DoctorService,
    private userService: UserService
  ) {}

  async ngOnInit() {
    const currentUser = await this.userService.getCurrentUserProfile();

    if (currentUser) {
      this.currentUserId = currentUser.uid;
      await this.loadInvitations();
    }
  }

  async loadInvitations() {
    try {
      this.receivedInvitations =
        await this.doctorService.getReceivedInvitations(this.currentUserId);
    } catch (error) {
      console.error('Error loading invitations:', error);
      this.showToast('Error loading invitations', 'danger');
    }
  }

  async acceptInvitation(invitationId: string) {
    const alert = await this.alertController.create({
      header: 'Accept patient invitation',
      message: 'Are you sure you want to accept this patient invitation?',
      buttons: [

        {
          text: 'Accept',
          handler: async () => {
            try {
              const accepted = this.receivedInvitations.find(
                invitation => invitation.id === invitationId
              );

              const patientName = accepted?.fromUserName || 'The patient';

              await this.doctorService.acceptDoctorInvitationWithUser(
                invitationId,
                this.currentUserId
              );

              this.showToast(
                `${patientName} is now your patient.`,
                'success'
              );

              await this.loadInvitations();
            } catch (error) {
              console.error('Error accepting invitation:', error);
              const message =
                error instanceof Error
                  ? error.message
                  : 'Error accepting invitation';

              this.showToast(message, 'danger');
            }
          },
        },
                {
          text: 'Cancel',
          role: 'cancel',
        }
      ],
    });

    await alert.present();
  }

  async declineInvitation(invitationId: string) {
    const alert = await this.alertController.create({
      header: 'Decline patient invitation',
      message: 'Are you sure you want to decline this patient invitation?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Decline',
          role: 'destructive',
          handler: async () => {
            try {
              await this.doctorService.declineDoctorInvitationWithUser(
                invitationId,
                this.currentUserId
              );

              this.showToast('Invitation declined', 'medium');
              await this.loadInvitations();
            } catch (error) {
              console.error('Error declining invitation:', error);
              const message =
                error instanceof Error
                  ? error.message
                  : 'Error declining invitation';

              this.showToast(message, 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  getInvitationStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'accepted':
        return 'success';
      case 'declined':
        return 'danger';
      case 'cancelled':
        return 'medium';
      default:
        return 'medium';
    }
  }

  getPendingReceivedCount(): number {
    return this.receivedInvitations.filter(
      invitation => invitation.status === 'pending'
    ).length;
  }

  async showToast(message: string, color: string = 'medium') {
    const toast = await this.toastController.create({
      message,
      duration: color === 'success' ? 3000 : 2500,
      color,
      position: 'top',
    });

    await toast.present();
  }
}