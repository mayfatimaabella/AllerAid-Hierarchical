import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Medication } from '../../../core/services/medication.service';

@Component({
  selector: 'app-health-overview',
  template: `
    <ion-card>
      <ion-card-header>
        <ion-card-title>Health Overview</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        <ion-row>
          <ion-col size="4">
            <div class="stat-item">
              <div class="stat-number">{{ allergiesCount }}</div>
              <div class="stat-label">Allergies</div>
            </div>
          </ion-col>
          <ion-col size="4">
            <div class="stat-item">
              <div class="stat-number">{{ medicationsCount }}</div>
              <div class="stat-label">Medications</div>
            </div>
          </ion-col>
          <ion-col size="4">
            <div class="stat-item">
              <div class="stat-number">{{ buddiesCount }}</div>
              <div class="stat-label">Buddies</div>
            </div>
          </ion-col>
        </ion-row>
      </ion-card-content>
    </ion-card>
  `,
  styles: [`
    .stat-item {
      text-align: center;
    }
    .stat-number {
      font-size: 2rem;
      font-weight: bold;
      color: var(--ion-color-primary);
    }
    .stat-label {
      font-size: 0.9rem;
      color: var(--ion-color-medium);
    }
  `]
})
export class HealthOverviewComponent {
  @Input() allergiesCount: number = 0;
  @Input() medicationsCount: number = 0;
  @Input() buddiesCount: number = 0;
}







