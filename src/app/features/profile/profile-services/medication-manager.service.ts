
import { Injectable } from '@angular/core';
import { MedicationService } from '../../../core/services/medication.service';
import { MedicationReminderService } from '../../../core/services/medication-reminder.service';
import { ModalController, AlertController } from '@ionic/angular';
import type { Medication } from '../../../core/services/medication.service';

@Injectable({ providedIn: 'root' })
export class MedicationManagerService {
  constructor(
    private medicationService: MedicationService,
    private modalController: ModalController,
    private alertController: AlertController
  ) {}

  /**
   * Open edit medication modal
   */
  async editMedication(
    medication: Medication,
    loadUserMedications: () => Promise<void>
  ) {
    const modal = await this.modalController.create({
      component: (await import('../health/modals/add-edit-medication/add-edit-medication.modal')).AddMedicationModal,
      componentProps: {
        medication: medication,
        isEditMode: true
      }
    });
    modal.onDidDismiss().then((result) => {
      if (result.data?.saved) {
        loadUserMedications();
      }
    });
    await modal.present();
  }

  /**
   * Delete medication with confirmation
   */
  async deleteMedication(
    medicationId: string | undefined,
    userMedications: Medication[],
    loadUserMedications: () => Promise<void>,
    reminders: MedicationReminderService,
    presentToast: (msg: string) => void,
    alertController: AlertController,
    onDeleted?: () => void
  ) {
    if (!medicationId) {
      presentToast('Cannot delete medication - missing ID');
      return;
    }
    const medication = userMedications.find(med => med.id === medicationId);
    const medicationName = medication?.name || 'this medication';
    const alert = await alertController.create({
      header: 'Delete Medication',
      message: `Are you sure you want to delete "${medicationName}"? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'danger',
          handler: async () => {
            try {
              await this.medicationService.deleteMedication(medicationId);
              await loadUserMedications();
              try { await reminders.cancelForMedication(medicationId); } catch {}
              presentToast('Medication removed successfully');
              if (onDeleted) {
                onDeleted();
              }
            } catch (error) {
              presentToast('Error removing medication');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  toggleDetails(id: string, expandedMedicationIds: Set<string>) {
    if (expandedMedicationIds.has(id)) {
      expandedMedicationIds.delete(id);
    } else {
      expandedMedicationIds.add(id);
    }
  }

  filterMedications(
    userMedications: Medication[],
    medicationFilter: string,
    medicationSearchTerm: string,
    medicationFilterCache: Map<string, Medication[]>,
    setFilteredMedications: (meds: Medication[]) => void
  ) {
    const cacheKey = `${medicationFilter}-${medicationSearchTerm}`;
    if (medicationFilterCache.has(cacheKey)) {
      setFilteredMedications(medicationFilterCache.get(cacheKey)!);
      return;
    }
    let filtered = [...userMedications];
    if (medicationSearchTerm && medicationSearchTerm.trim()) {
      const term = medicationSearchTerm.toLowerCase();
      filtered = filtered.filter(med =>
        med.name.toLowerCase().includes(term) ||
        med.notes?.toLowerCase().includes(term) ||
        med.dosage.toLowerCase().includes(term) ||
        med.prescribedBy?.toLowerCase().includes(term) ||
        med.frequency?.toLowerCase().includes(term)
      );
    }
    switch (medicationFilter) {
      case 'active':
        filtered = filtered.filter(med => {
          const isActive = med.isActive;

          // Treat medications with no pills left or already expired as not active,
          // even if their isActive flag is still true in the database.
          const noPillsLeft = typeof med.quantity === 'number' && med.quantity <= 0;
          const isExpired = med.expiryDate && new Date(med.expiryDate) < new Date();

          return isActive && !noPillsLeft && !isExpired;
        });
        break;
      case 'emergency':
        filtered = filtered.filter(med =>
          med.category === 'emergency' ||
          med.category === 'allergy' ||
          (med as any).emergencyMedication === true
        );
        break;
    }
    setFilteredMedications(filtered);
    medicationFilterCache.set(cacheKey, filtered);
  }

  async toggleMedicationStatus(
    medicationId: string | undefined,
    loadUserMedications: () => Promise<void>,
    userMedications: Medication[],
    reminders: MedicationReminderService,
    refreshEHRData: () => Promise<void>,
    presentToast: (msg: string) => void
  ) {
    if (!medicationId) {
      presentToast('Cannot update medication - missing ID');
      return;
    }

    const med = userMedications.find((m: any) => m.id === medicationId);
    const quantity = med && med.quantity !== undefined && med.quantity !== null
      ? Number(med.quantity)
      : NaN;

    // Prevent activating a medication that has no pills left
    if (med && med.isActive === false && !isNaN(quantity) && quantity <= 0) {
      presentToast('Cannot activate medication with no pills remaining. Please update the quantity first.');
      return;
    }

    try {
      await this.medicationService.toggleMedicationStatus(medicationId);
      await loadUserMedications();
      try {
        const med = userMedications.find((m: any) => m.id === medicationId);
        if (med) {
          await reminders.scheduleForMedication(med);
        }
      } catch {}
      await refreshEHRData();
    } catch (error) {
      presentToast('Error loading EHR data');
    }
  }

}
