import { Injectable } from '@angular/core';
import { AllergyService } from './allergy.service';
import { ToastController } from '@ionic/angular';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AllergyOptionsService {
  constructor(
    private allergyService: AllergyService,
    private toastController: ToastController
  ) {}

  async getProcessedAllergyOptions(): Promise<any[]> {
    try {
      const options = await this.allergyService.getAllergyOptions();
      if (options && options.length > 0) {
        const uniqueOptions = options.reduce((acc: any[], option: any) => {
          const exists = acc.find(item => item.name === option.name);
          if (!exists) acc.push(option);
          return acc;
        }, []);
        const processed = uniqueOptions
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(option => ({
            name: option.name,
            label: option.label,
            checked: false,
            hasInput: option.hasInput || false,
            value: ''
          }));
        if (!environment.production) {
          console.log('Loaded allergy options:', processed);
        }
        return processed;
      } else {
        if (!environment.production) {
          console.log('No allergy options configured by admin');
        }
        return [];
      }
    } catch (error) {
      console.error('Error loading allergy options:', error);
      const toast = await this.toastController.create({
        message: 'Unable to load allergy options. Please contact administrator.',
        duration: 4000,
        position: 'bottom',
        color: 'danger'
      });
      await toast.present();
      return [];
    }
  }
}
