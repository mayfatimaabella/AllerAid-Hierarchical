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
    refreshAllergiesDisplay: () => Promise<void>
  ) {
    const modal = await this.modalController.create({
      component: (await import('../overview/modals/edit-allergies-modal/edit-allergies-modal.component')).EditAllergiesModalComponent,
      componentProps: {
        allergyOptions: allergyOptions
      },
      cssClass: 'force-white-modal'
    });

    modal.onDidDismiss().then(async (result) => {
      if (result.data?.refresh && result.data?.allergyOptions) {
        const currentUser = await this.authService.waitForAuthInit();
        if (!currentUser) return;
        const userAllergyDocs = await this.allergyService.getUserAllergies(currentUser.uid);
        if (userAllergyDocs && userAllergyDocs.length > 0) {
          await this.allergyService.updateUserAllergies(userAllergyDocs[0].id, result.data.allergyOptions);
        } else {
          await this.allergyService.addUserAllergies(currentUser.uid, result.data.allergyOptions);
        }
        await refreshAllergiesDisplay();
      }
    });

    await modal.present();
  }
}
