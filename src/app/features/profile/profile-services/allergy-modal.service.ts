import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { AllergyService } from '../../../core/services/allergy.service';

@Injectable({ providedIn: 'root' })
export class AllergyModalService {
  constructor(
    private modalController: ModalController,
    private authService: AuthService,
    private allergyService: AllergyService
  ) {}

  async openEditAllergiesModal(
    allergyOptions: any[],
    refreshAllergiesDisplay: () => Promise<void>,
    mode: 'add' | 'edit' = 'edit'
  ): Promise<void> {
    const modal = await this.modalController.create({
      component: (
        await import('../overview/modals/edit-allergies-modal/edit-allergies-modal.component')
      ).EditAllergiesModalComponent,
      componentProps: {
        allergyOptions,
        mode
      },
      cssClass: 'force-white-modal'
    });

    modal.onDidDismiss().then(async (result) => {
      if (!result.data?.saved || !result.data?.allergyOptions) return;

      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      const selectedAllergies = result.data.allergyOptions
        .filter((allergy: any) => allergy.checked)
        .map((allergy: any) => {
          const customValue = String(allergy.value || '').trim();

          return {
            name: allergy.name,
            checked: true,
            label: allergy.hasInput ? customValue : allergy.label,
            value: allergy.hasInput ? customValue : (allergy.value || allergy.label)
          };
        });

      await this.allergyService.saveUserAllergies(
        currentUser.uid,
        selectedAllergies
      );

      await refreshAllergiesDisplay();
    });

    await modal.present();
  }
}