import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { EmergencyService, EmergencyAlert } from '../../../../core/services/emergency.service';
import { BuddyService } from '../../../../core/services/buddy.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { ResponderMapPageModule } from '../../../emergency/responder-map/responder-map.module';
import { ResponderMapPage } from '../../../emergency/responder-map/responder-map.page';

@Component({
  selector: 'app-emergencies',
  templateUrl: './emergencies.page.html',
  styleUrls: ['./emergencies.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, ResponderMapPageModule]
})
export class EmergenciesPage implements OnInit, OnDestroy {
  activeEmergencies: EmergencyAlert[] = [];
  allEmergencies: EmergencyAlert[] = [];
  filteredEmergencies: EmergencyAlert[] = [];
  selectedFilter: string = 'all';
  selectedTab: string = 'active';
  private resolvedEmergencies: EmergencyAlert[] = [];
  private dismissedEmergencyIds = new Set<string>();
  private dismissedHistoryIds = new Set<string>();
  private emergencySubscription: Subscription | null = null;
  private locationAddressCache = new Map<string, string>();

  constructor(
    private router: Router,
    private emergencyService: EmergencyService,
    private buddyService: BuddyService,
    private authService: AuthService,
    private modalController: ModalController
  ) { }

  async ngOnInit() {
    await this.setupRealTimeEmergencyListener();
  }

  ngOnDestroy() {
    if (this.emergencySubscription) {
      this.emergencySubscription.unsubscribe();
    }
  }

  private async setupRealTimeEmergencyListener() {
    try {
      const user = await this.authService.waitForAuthInit();
      if (user) {
        // Start listening for emergency alerts for this buddy
        this.buddyService.listenForEmergencyAlerts(user.uid);
        
        // Subscribe to the emergency alerts observable from buddy service
        this.emergencySubscription = this.buddyService.activeEmergencyAlerts$.subscribe(async emergencies => {
          // Load resolved emergencies (where this user is a buddy)
          this.resolvedEmergencies = await this.emergencyService.getBuddyEmergenciesByStatus(user.uid, ['resolved']);

          // Also load emergencies this user initiated (patient view of their own alerts)
          const userInitiated = await this.emergencyService.getUserEmergenciesByStatus(
            user.uid,
            ['active', 'responding', 'resolved']
          );

          // Compute active emergencies as union of buddy alerts and user-initiated active/responding
          const buddyActive = emergencies
            .filter(e => (e.status === 'active' || e.status === 'responding'))
            .filter(e => !this.dismissedEmergencyIds.has(e.id!));

          const userActive = userInitiated.filter(e => e.status === 'active' || e.status === 'responding');

          const activeMerged = new Map<string, EmergencyAlert>();
          [...buddyActive, ...userActive].forEach(e => {
            if (e.id) {
              activeMerged.set(e.id, e);
            }
          });

          this.activeEmergencies = Array.from(activeMerged.values());

          // Merge all emergency sources into a single list, de-duplicated by id
          const merged = new Map<string, EmergencyAlert>();
          [...emergencies, ...this.resolvedEmergencies, ...userInitiated].forEach((e) => {
            if (e.id) {
              merged.set(e.id, e);
            }
          });

          this.allEmergencies = Array.from(merged.values());

          // Enrich emergencies with human-readable addresses
          await this.populateAddresses(this.allEmergencies);
          this.filterEmergencies();
        });
      }
    } catch (error) {
      console.error('Error setting up emergency listener:', error);
    }
  }

  async dismissEmergency(emergency: EmergencyAlert) {
    try {
      const user = await this.authService.waitForAuthInit();
      if (user && emergency.id) {
        // Persist dismissal so future pop-ups are suppressed
        this.buddyService.dismissEmergencyForUser(user.uid, emergency.id);
        // Save a snapshot of the dismissed alert for local history
        this.buddyService.saveDismissedAlertData(user.uid, emergency);
        // Update lists immediately without waiting for next snapshot
        this.dismissedEmergencyIds.add(emergency.id);
        this.activeEmergencies = this.activeEmergencies.filter(e => e.id !== emergency.id);
        // Track in local dismissed history ids (no type change)
        this.dismissedHistoryIds.add(emergency.id);
        this.filterEmergencies();
      }
    } catch (error) {
      console.error('Error dismissing emergency:', error);
    }
  }

  filterEmergencies() {
    switch (this.selectedFilter) {
      case 'resolved':
        this.filteredEmergencies = this.allEmergencies.filter(e => e.status === 'resolved');
        break;
      case 'responding':
        this.filteredEmergencies = this.allEmergencies.filter(e => e.status === 'responding');
        break;
      case 'dismissed':
        this.filteredEmergencies = this.getDismissedAlertsForCurrentUser();
        break;
      default:
        // All = active history (resolved/responding/etc.) + dismissed history
        const dismissed = this.getDismissedAlertsForCurrentUser();
        const merged = new Map<string, EmergencyAlert>();

        this.allEmergencies.forEach(e => {
          if (e.id) {
            merged.set(e.id, e);
          }
        });

        dismissed.forEach(e => {
          if (e.id) {
            // Dismissed entries override same-id entries so their status
            // is shown as 'dismissed' in the All view
            merged.set(e.id, e);
          }
        });

        this.filteredEmergencies = Array.from(merged.values());
    }
  }

  onTabChange() {
    // Reset filter when switching tabs
    this.selectedFilter = 'all';
    this.filterEmergencies();
  }

  private getDismissedAlertsForCurrentUser(): EmergencyAlert[] {
    try {
      // Prefer auth service for reliable UID
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const uid = user?.uid;
      if (!uid) {
        return [];
      }
      const key = `dismissedAlerts_${uid}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      // Map stored minimal objects back to EmergencyAlert-like shape where possible,
      // enrich with known fields from current allEmergencies list
      return stored.map((a: any) => {
        const match = this.allEmergencies.find(e => e.id === a.id);
        return {
          id: a.id,
          // Always mark these as 'dismissed' for the Dismissed segment label
          status: 'dismissed',
          timestamp: match?.timestamp || a.createdAt,
          location: a.location || match?.location,
          responderId: a.responderId || match?.responderId,
          responderName: a.responderName || match?.responderName,
          userName: match?.userName || a.patientName || 'Unknown',
          patientId: a.patientId || (match as any)?.patientId,
          patientName: a.patientName || (match as any)?.patientName
        } as any;
      });
    } catch {
      return [];
    }
  }

  getStatusDisplay(emergency: EmergencyAlert): string {
    if (emergency.id && this.dismissedHistoryIds.has(emergency.id)) {
      return 'dismissed';
    }
    return emergency.status;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'resolved': return 'success';
      case 'responding': return 'warning';
      case 'active': return 'danger';
      case 'dismissed': return 'medium';
      default: return 'medium';
    }
  }

  async refreshEmergencies() {
    await this.setupRealTimeEmergencyListener();
  }

  async respondToEmergency(emergency: EmergencyAlert) {
    try {
      const user = await this.authService.waitForAuthInit();
      if (user) {
        // Update emergency status and navigate to map
        await this.emergencyService.respondToEmergency(
          emergency.id!, 
          user.uid, 
          user.displayName || 'Buddy Response'
        );
        this.viewOnMap(emergency);
      }
    } catch (error) {
      console.error('Error responding to emergency:', error);
    }
  }

  async viewOnMap(emergency: EmergencyAlert) {
    const modal = await this.modalController.create({
      component: ResponderMapPage,
      componentProps: {
        responder: {
          emergencyId: emergency.id,
          responderName: emergency.responderName || 'Buddy Response'
        }
      },
      cssClass: 'responder-map-modal',
      initialBreakpoint: 0.95,
      breakpoints: [0.12, 0.5, 0.75, 0.95],
      handle: true,
      handleBehavior: 'cycle'
    });
    await modal.present();
  }

  callPatient(emergency: EmergencyAlert) {
    // Trigger phone call - would need patient phone number from emergency data
    console.log('Calling patient for emergency:', emergency.id);
    // TODO: Implement phone integration when patient phone numbers are available
  }

  viewEmergencyDetails(emergency: EmergencyAlert) {
    // Show detailed emergency information
    this.router.navigate(['/emergency-details', emergency.id]);
  }

  private async populateAddresses(emergencies: EmergencyAlert[]): Promise<void> {
    const tasks: Promise<void>[] = [];

    for (const e of emergencies) {
      const loc: any = (e as any).location;
      if (!loc || !loc.latitude || !loc.longitude) {
        continue;
      }

      const key = `${loc.latitude},${loc.longitude}`;
      if (this.locationAddressCache.has(key)) {
        (e as any).displayAddress = this.locationAddressCache.get(key);
        continue;
      }

      tasks.push((async () => {
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${loc.latitude}&lon=${loc.longitude}`;
          const response = await fetch(url);
          const data = await response.json();
          // Prefer human-readable address; fall back to coordinates
          const address: string = data?.display_name || this.getLocationDisplay(loc);
          this.locationAddressCache.set(key, address);
          (e as any).displayAddress = address;
        } catch {
          // If reverse geocoding fails, still show coordinates
          (e as any).displayAddress = this.getLocationDisplay(loc);
        }
      })());
    }

    if (tasks.length) {
      await Promise.all(tasks);
    }
  }

  getLocationDisplay(location: any): string {
    if (location && location.latitude && location.longitude) {
      return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
    }
    return 'Location unavailable';
  }

  getTimeAgo(timestamp: any): string {
    if (!timestamp) return 'Unknown time';
    
    const now = new Date();
    const alertTime = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }
}
