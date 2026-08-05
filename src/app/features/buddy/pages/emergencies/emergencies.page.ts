import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { EmergencyService } from '../../../../core/services/emergency.service';
import { BuddyService } from '../../../../core/services/buddy.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EmergencyAlert } from '../../../../core/models/emergency-alert.model';
import { EmergencyLocation } from 'src/app/core/models/emergency-location.model';
import { Timestamp } from '@angular/fire/firestore';

interface DismissedEmergency {
  id: string;
  status?: string;
  createdAt: string;
  location?: EmergencyLocation;
  responderId?: string;
  responderName?: string;
  patientName?: string;
}

type EmergencyWithDismissed = EmergencyAlert & {
  dismissed?: boolean;
};

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
  filteredEmergencies: EmergencyWithDismissed[] = [];
  selectedFilter: string = 'all';
  selectedTab: string = 'incoming';
  private resolvedEmergencies: EmergencyAlert[] = [];
  private dismissedEmergencyIds = new Set<string>();
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

  ngOnDestroy(): void {
    this.emergencySubscription?.unsubscribe();
  }

  private async setupRealTimeEmergencyListener(): Promise<void> {

    this.emergencySubscription?.unsubscribe();
    this.emergencySubscription = null;

    try {
      const user = await this.authService.waitForAuthInit();
      if (!user) {
        return;
      }

      this.buddyService.listenForEmergencyAlerts(user.uid);

      this.emergencySubscription =
        this.buddyService.activeEmergencyAlerts$.subscribe(async emergencies => {

          this.resolvedEmergencies =
            await this.emergencyService.getBuddyEmergenciesByStatus(
              user.uid,
              ['resolved', 'cancelled'] 
            );

          const userInitiated =
            await this.emergencyService.getUserEmergenciesByStatus(
              user.uid,
              ['active', 'responding', 'resolved', 'cancelled']
            );

          const buddyActive = emergencies
            .filter(e =>
              e.status === 'active' ||
              e.status === 'responding'
            )
            .filter(e => !this.dismissedEmergencyIds.has(e.id!));

          this.activeEmergencies = [...buddyActive];

          const merged = new Map<string, EmergencyAlert>();

          [
            ...emergencies,
            ...this.resolvedEmergencies,
            ...userInitiated
          ].forEach(e => {
            if (e.id) {
              merged.set(e.id, e);
            }
          });

          this.allEmergencies = Array.from(merged.values());

          await this.populateAddresses(this.allEmergencies);

          this.filterEmergencies();
        });

    } catch (error) {
      console.error(error);
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

        this.filterEmergencies();
      }
    } catch (error) {
      console.error('Error dismissing emergency:', error);
    }
  }

  filterEmergencies(): void {
    switch (this.selectedFilter) {

      case 'completed':
        this.filteredEmergencies = this.allEmergencies.filter(
          e => e.status === 'resolved' || e.status === 'cancelled'
        );
        break;

      case 'dismissed':
        this.filteredEmergencies = this.getDismissedAlertsForCurrentUser();
        break;

      case 'all':
      default: {
        const dismissed = this.getDismissedAlertsForCurrentUser();
        const merged = new Map<string, EmergencyAlert>();

        [...this.allEmergencies, ...dismissed].forEach(e => {
          if (e.id) {
            merged.set(e.id, e);
          }
        });

        this.filteredEmergencies = Array.from(merged.values());
        break;
      }
    }
  }

  onTabChange() {
    this.selectedFilter = 'all';
    this.filterEmergencies();
  }

private getDismissedAlertsForCurrentUser(): EmergencyWithDismissed[] {
  try {

    const user: { uid?: string } =
      JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!user.uid) {
      return [];
    }

    const key = `dismissedAlerts_${user.uid}`;

    const stored: DismissedEmergency[] =
      JSON.parse(localStorage.getItem(key) || '[]');

    return stored.map(a => {

      const match = this.allEmergencies.find(e => e.id === a.id);

      return {
        ...(match ?? {}),
        id: a.id,
        status: match?.status ?? 'resolved',
        dismissed: true,
        timestamp: match?.timestamp ?? a.createdAt,
        location: match?.location ?? a.location,
        responderId: match?.responderId ?? a.responderId,
        responderName: match?.responderName ?? a.responderName,
        userName: match?.userName ?? a.patientName ?? 'Unknown'
      } as EmergencyWithDismissed;

    });

  } catch {

    return [];

  }
}

  getStatusDisplay(emergency: EmergencyWithDismissed): string {

    if (emergency.dismissed) {
      return 'dismissed';
    }

    return emergency.status;

  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'danger';

      case 'responding':
        return 'warning';

      case 'resolved':
        return 'success';

      case 'cancelled':
        return 'medium';

      case 'dismissed':
        return 'dark';

      default:
        return 'medium';
    }
  }

  async refreshEmergencies(): Promise<void> {
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

  for (const emergency of emergencies) {

    if (emergency.displayAddress) {
      continue;
    }

    if (!emergency.location) {
      continue;
    }

    const { latitude, longitude } = emergency.location;

    const key = `${latitude},${longitude}`;

    const cached = this.locationAddressCache.get(key);

    if (cached) {
      emergency.displayAddress = cached;
      continue;
    }

    tasks.push((async () => {

      try {

        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
        );

        const data = await response.json();

        const address = data?.display_name ?? this.getLocationDisplay(emergency.location);
        
        emergency.displayAddress = address;
        
        this.locationAddressCache.set(key, address);

      } catch {

        emergency.displayAddress =
          this.getLocationDisplay(emergency.location);

      }

    })());

  }

  await Promise.all(tasks);
}

  getLocationDisplay(location: EmergencyLocation | null | undefined): string {
    if (!location) {
      return 'Location unavailable';
    }

    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }

 getTimeAgo(
  timestamp: Timestamp | Date | string | null | undefined
): string {

  if (!timestamp) {
    return 'Unknown time';
  }

  let alertTime: Date;

  if (timestamp instanceof Date) {
    alertTime = timestamp;
  } else if (timestamp instanceof Timestamp) {
    alertTime = timestamp.toDate();
  } else {
    alertTime = new Date(timestamp);
  }

  const now = new Date();
  const diffMs = now.getTime() - alertTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);

  if (diffHours < 24) return `${diffHours}h ago`;

  return `${Math.floor(diffHours / 24)}d ago`;
}

toDate(timestamp: Timestamp | Date | string | null | undefined): Date | null {
  if (!timestamp) return null;

  if (timestamp instanceof Date) {
    return timestamp;
  }

  if (timestamp instanceof Timestamp) {
    return timestamp.toDate();
  }

  return new Date(timestamp);
}
}