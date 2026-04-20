
import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ImageViewerModal } from '../change-password/image-viewer.modal';

@Injectable({ providedIn: 'root' })
export class MedicationActionsService {
	constructor(private modalController: ModalController) {}

	/**
	 * Show medication image (could open a modal or new window)
	 */
	viewMedicationImage(url: string, title: string) {
		if (!url) {
			return;
		}

		void this.openImageViewerModal(url, title);
	}

	private async openImageViewerModal(url: string, title: string): Promise<void> {
		const modal = await this.modalController.create({
			component: ImageViewerModal,
			componentProps: {
				imageUrl: url,
				title: title || 'Image',
				fileName: `${(title || 'medication-image').toLowerCase().replace(/\s+/g, '-')}.jpg`
			}
		});

		await modal.present();
	}

	/**
	 * Open medication details (delegates to component for modal state)
	 * Pass the component instance to set selectedMedication and modal flag
	 */
	openMedicationDetails(medication: any, component: any) {
		// Set the selected medication and show the modal via the manager
		component.profileMedicationManager.selectedMedication = medication;
		component.profileMedicationManager.showMedicationDetailsModal = true;
	}
}
