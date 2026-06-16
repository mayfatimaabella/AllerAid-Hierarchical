import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, AlertController, ModalController } from '@ionic/angular';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { BuddyService } from '../../core/services/buddy.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit, OnDestroy {
  userRole: string | null = null;
  roleLoaded = false;
  userProfile: any = null;

  invitationCount = 0;
  emergencyCount = 0;

  private shownEmergencyIds: Set<string> = new Set<string>();
  private isInitialized = false;
  private isListenersSetup = false;

  private invitationSubscription: Subscription | null = null;
  private emergencySubscription: Subscription | null = null;
  private buddyRelationSubscription: Subscription | null = null;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private buddyService: BuddyService,
    private router: Router,
    private toastController: ToastController,
    private alertController: AlertController,
    private modalController: ModalController
  ) {}

  async ngOnInit() {
    if (this.isInitialized) {
      return;
    }

    await this.loadUserRole();
    await this.setupNotificationListeners();
    await this.handleInitialNavigation();

    this.isInitialized = true;
  }

  ngOnDestroy() {
    this.invitationSubscription?.unsubscribe();
    this.emergencySubscription?.unsubscribe();
    this.buddyRelationSubscription?.unsubscribe();
  }

  private async loadUserRole() {
    try {
      const user = await this.authService.waitForAuthInit();

      if (!user) {
        this.userRole = 'user';
        this.roleLoaded = true;
        return;
      }

      this.userProfile = await this.userService.getUserProfile(user.uid);
      this.userRole = this.userProfile?.role || 'user';
      this.roleLoaded = true;
    } catch (error) {
      console.error('Error loading user role:', error);
      this.userRole = 'user';
    }
  }

  private async setupNotificationListeners() {
    if (this.isListenersSetup) {
      return;
    }

    try {
      const user = await this.authService.waitForAuthInit();

      if (!user || !this.userProfile) {
        return;
      }

      /**
       * Only normal users should receive buddy/contact emergency listeners.
       * Doctors should not listen to patient emergency contact popups here.
       */
      if (this.userRole !== 'user') {
        this.isListenersSetup = true;
        return;
      }

      this.buddyService.listenForEmergencyAlerts(user.uid);

      this.emergencySubscription =
        this.buddyService.activeEmergencyAlerts$.subscribe(async alerts => {
          const previousCount = this.emergencyCount;
          const activeAlerts = alerts.filter((alert: any) => alert.status === 'active');

          this.emergencyCount = activeAlerts.length;

          if (this.emergencyCount > previousCount && activeAlerts.length > 0) {
            const sorted = [...activeAlerts].sort((a: any, b: any) => {
              const ta = a.timestamp?.toDate?.()?.getTime() ?? a.timestamp ?? 0;
              const tb = b.timestamp?.toDate?.()?.getTime() ?? b.timestamp ?? 0;
              return tb - ta;
            });

            const latest = sorted[0];
            const alreadyShown = latest?.id && this.shownEmergencyIds.has(latest.id);

            if (latest?.id && !alreadyShown) {
              this.shownEmergencyIds.add(latest.id);
              await this.showEmergencyPopup(latest);
            }

            this.playEmergencyNotificationFeedback();
          }
        });

      if (this.userProfile?.email) {
        this.buddyService.listenForBuddyInvitations(this.userProfile.email);

        this.invitationSubscription =
          this.buddyService.pendingInvitations$.subscribe(invitations => {
            const previousCount = this.invitationCount;
            this.invitationCount = invitations.length;

            if (this.invitationCount > previousCount && previousCount > 0) {
              this.showNewInvitationNotification();
            }
          });
      }

      this.buddyService.listenForBuddyRelations(user.uid);

      this.buddyRelationSubscription =
        this.buddyService.buddyRelations$.subscribe(relations => {
          console.log('Contact relations updated:', relations.length);
        });

      await this.loadInvitationCount(user.uid);

      this.isListenersSetup = true;
    } catch (error) {
      console.error('Error setting up notification listeners:', error);
    }
  }

  private navigateToRoleDashboard() {
    if (this.userRole === 'doctor') {
      this.router.navigate(['/tabs/doctor-dashboard']);
      return;
    }

    this.router.navigate(['/tabs/home']);
  }

  private async handleInitialNavigation() {
     const currentUrl = this.router.url;

  if (currentUrl.startsWith('/tabs/')) {
    return;
  }
    this.navigateToRoleDashboard();
  }

  private playEmergencyNotificationFeedback() {
    try {
      const audio = new Audio('assets/sounds/emergency-alert.wav');
      audio.play().catch(err => console.log('Could not play audio:', err));

      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (error) {
      console.log('Notification feedback error:', error);
    }
  }

  private async showEmergencyPopup(alert: any) {
    try {
      const { ResponderDashboardPage } = await import(
        '../../features/dashboard/responder-dashboard/responder-dashboard.page'
      );

      const modal = await this.modalController.create({
        component: ResponderDashboardPage,
        componentProps: {
          responderData: {
            emergencyId: alert.id,
            userName: alert.userName || alert.patientName,
            instruction:
              alert.emergencyInstruction ||
              alert.instruction ||
              alert.instructions ||
              '',
            alert: {
              id: alert.id,
              userId: alert.userId,
              userName: alert.userName || alert.patientName,
              instruction: alert.emergencyInstruction || alert.instruction,
              emergencyInstruction: alert.emergencyInstruction || alert.instruction,
              location: alert.location,
              status: alert.status,
              timestamp: alert.timestamp
            }
          }
        },
        cssClass: 'responder-dashboard-modal',
        backdropDismiss: false
      });

      await modal.present();

      modal.onDidDismiss().then(async detail => {
        if (alert?.id) {
          this.shownEmergencyIds.add(alert.id);
        }

        const role = detail?.role || '';
        const data = detail?.data || {};

        if (role === 'responded' && data.openMap) {
          await this.openResponderMapModal(data);
          return;
        }

        if (!role || role === 'cancel') {
          this.navigateToRoleDashboard();
        }
      });
    } catch (error) {
      console.error('Failed to show responder dashboard modal:', error);

      try {
        const fallback = await this.alertController.create({
          header: 'Emergency Alert',
          message: `
            ${alert.userName || alert.patientName || 'A connection'} needs help.
            ${
              alert.emergencyInstruction || alert.instruction
                ? '<br/><small>' + (alert.emergencyInstruction || alert.instruction) + '</small>'
                : ''
            }
          `,
          cssClass: 'emergency-alert-modal',
          buttons: [
            {
              text: 'View dashboard',
              handler: () => this.router.navigate(['/tabs/responder-dashboard'])
            },
            {
              text: 'Dismiss',
              role: 'cancel'
            }
          ]
        });

        await fallback.present();

        fallback.onDidDismiss().then(() => {
          this.navigateToRoleDashboard();
        });
      } catch (innerError) {
        console.error('Also failed to show fallback alert:', innerError);
      }
    }
  }

  private async openResponderMapModal(data: {
    responderName: string;
    emergencyId: string;
    patientLocation?: any;
  }) {
    try {
      const { ResponderMapPage } = await import(
        '../../features/emergency/responder-map/responder-map.page'
      );

      const mapModal = await this.modalController.create({
        component: ResponderMapPage,
        componentProps: {
          responder: {
            responderName: data.responderName,
            emergencyId: data.emergencyId,
            patientLocation: data.patientLocation
          }
        },
        cssClass: 'responder-map-modal',
        initialBreakpoint: 0.95,
        breakpoints: [0.12, 0.5, 0.75, 0.95],
        handle: true,
        handleBehavior: 'cycle'
      });

      await mapModal.present();
    } catch (error) {
      console.error('Failed to open responder map:', error);
    }
  }

  private async showNewInvitationNotification() {
    const toast = await this.toastController.create({
      message: 'New emergency contact invitation received!',
      duration: 4000,
      position: 'top',
      color: 'primary',
      buttons: [
        {
          text: 'View',
          handler: () => {
            this.router.navigate(['/tabs/buddy']);
          }
        },
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });

    await toast.present();
  }

  private async loadInvitationCount(userId: string) {
    try {
      const invitations = await this.buddyService.getReceivedInvitations(userId);
      this.invitationCount = invitations.filter(inv => inv.status === 'pending').length;
    } catch (error) {
      console.error('Error loading invitation count:', error);
      this.invitationCount = 0;
    }
  }
}