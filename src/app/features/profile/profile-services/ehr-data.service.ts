import { Injectable } from '@angular/core';
import { EHRService } from '../../../core/services/ehr.service';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class EHRDataService {
  constructor(private ehrService: EHRService) {}

  /**
   * Loads EHR-related data: medical history, access list, healthcare providers
   */
  async loadEHRData(): Promise<{
    medicalHistory: any[];
    ehrAccessList: any[];
    healthcareProviders: any[];
  }> {
    const medicalHistory = await this.ehrService.getMedicalHistory();
    const ehrRecord = await this.ehrService.getEHRRecord();
    const ehrAccessList = ehrRecord?.accessibleBy || [];
    const healthcareProviders = await this.ehrService.getHealthcareProviders();
    if (!environment.production) {
      console.log('Loaded EHR data (service):', {
        medicalHistory,
        ehrAccessList,
        healthcareProviders
      });
    }
    return { medicalHistory, ehrAccessList, healthcareProviders };
  }
}
