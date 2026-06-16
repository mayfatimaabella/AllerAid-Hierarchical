import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { EmergencyService, EmergencyAlert } from '../../../../core/services/emergency.service';
import { BuddyService } from '../../../../core/services/buddy.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-emergencies',
  templateUrl: './emergencies.page.html',
  styleUrls: ['./emergencies.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
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
        
        this.buddyService.listenForEmergencyAlerts(user.uid);
        
        this.emergencySubscription = this.buddyService.activeEmergencyAlerts$.subscribe(async emergencies => {
        
          this.resolvedEmergencies = await this.emergencyService.getBuddyEmergenciesByStatus(user.uid, ['resolved']);

          const userInitiated = await this.emergencyService.getUserEmergenciesByStatus(
            user.uid,
            ['active', 'responding', 'resolved']
          );

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

          const merged = new Map<string, EmergencyAlert>();
          [...emergencies, ...this.resolvedEmergencies, ...userInitiated].forEach((e) => {
            if (e.id) {
              merged.set(e.id, e);
            }
          });

          this.allEmergencies = Array.from(merged.values());

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

        this.buddyService.dismissEmergencyForUser(user.uid, emergency.id);

        this.buddyService.saveDismissedAlertData(user.uid, emergency);

        this.dismissedEmergencyIds.add(emergency.id);
        this.activeEmergencies = this.activeEmergencies.filter(e => e.id !== emergency.id);

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

        const dismissed = this.getDismissedAlertsForCurrentUser();
        const merged = new Map<string, EmergencyAlert>();

        this.allEmergencies.forEach(e => {
          if (e.id) {
            merged.set(e.id, e);
          }
        });

        dismissed.forEach(e => {
          if (e.id) {

            merged.set(e.id, e);
          }
        });

        this.filteredEmergencies = Array.from(merged.values());
    }
  }

  onTabChange() {
    this.selectedFilter = 'all';
    this.filterEmergencies();
  }

  private getDismissedAlertsForCurrentUser(): EmergencyAlert[] {
    try {

      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const uid = user?.uid;
      if (!uid) {
        return [];
      }
      const key = `dismissedAlerts_${uid}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');

      return stored.map((a: any) => {
        const match = this.allEmergencies.find(e => e.id === a.id);
        return {
          id: a.id,

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
    await this.router.navigate(['/tabs/responder-dashboard'], {
      state: {
        emergencyData: {
          emergencyId: emergency.id,
          alert: emergency,
          userName: emergency.userName
        }
      }
    });
  }
  callPatient(emergency: EmergencyAlert) {

    console.log('Calling patient for emergency:', emergency.id);

  }

  viewEmergencyDetails(emergency: EmergencyAlert) {

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

          const address: string = data?.display_name || this.getLocationDisplay(loc);
          this.locationAddressCache.set(key, address);
          (e as any).displayAddress = address;
        } catch {

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
