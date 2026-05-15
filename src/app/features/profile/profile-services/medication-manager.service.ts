import { Injectable } from '@angular/core';
import { ModalController, AlertController } from '@ionic/angular';
import { MedicationService, Medication } from '../../../core/services/medication.service';
import { MedicationReminderService } from '../../../core/services/medication-reminder.service';

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
   * Deduct a single pill and refresh the UI
   * Uses Number() casting to prevent math errors and auto-deactivates at 0.
   */
  async markDoseAsTaken(
    medicationId: string,
    userMedications: Medication[],
    loadUserMedications: () => Promise<void>,
    presentToast: (msg: string) => void
  ) {
    const med = userMedications.find(m => m.id === medicationId);
    
    if (med) {
      // Force quantity to a number to avoid string concatenation or NaN issues
      const currentQuantity = Number(med.quantity) || 0;

      if (currentQuantity > 0) {
        try {
          const newQuantity = currentQuantity - 1;
          
          await this.medicationService.updateMedication(medicationId, {
            quantity: newQuantity,
            // Automatically set to inactive only when truly out of pills
            isActive: newQuantity > 0 
          });

          // Refresh local state so UI updates "live"
          await loadUserMedications(); 
          presentToast(`Dose recorded! ${newQuantity} pills remaining.`);
        } catch (error) {
          presentToast('Error updating pill count');
        }
      } else {
        presentToast('No pills left to deduct!');
      }
    }
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
        { text: 'Cancel', role: 'cancel', cssClass: 'secondary' },
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
              if (onDeleted) onDeleted();
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

  /**
   * Filter medications based on Ongoing/Completed logic
   */
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

    const now = new Date();
    let filtered = [...userMedications];

    if (medicationSearchTerm && medicationSearchTerm.trim()) {
      const term = medicationSearchTerm.toLowerCase();
      filtered = filtered.filter(med =>
        med.name.toLowerCase().includes(term) ||
        med.notes?.toLowerCase().includes(term) ||
        med.dosage.toLowerCase().includes(term)
      );
    }

    switch (medicationFilter) {
      case 'active':
        filtered = filtered.filter(med => {
          const remaining = Number(med.quantity) || 0;
          const isExpired = med.expiryDate && new Date(med.expiryDate) < now;
          // Ongoing: Active AND has pills AND not expired
          return med.isActive && remaining > 0 && !isExpired;
        });
        break;

      case 'finished': 
        filtered = filtered.filter(med => {
          const remaining = Number(med.quantity) || 0;
          const isExpired = med.expiryDate && new Date(med.expiryDate) < now;
          const isInactive = med.isActive === false;
          // History: No pills left OR Expired OR Manually stopped
          return isInactive || remaining <= 0 || isExpired;
        });
        break;

      case 'emergency':
        filtered = filtered.filter(med =>
          med.category === 'emergency' || med.category === 'allergy'
        );
        break;
    }

    setFilteredMedications(filtered);
    medicationFilterCache.set(cacheKey, filtered);
  }

  /**
   * Toggle medication active status manually
   */
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
    const quantity = Number(med?.quantity) || 0;

    if (med && med.isActive === false && quantity <= 0) {
      presentToast('Cannot activate medication with no pills remaining. Update quantity first.');
      return;
    }

    try {
      await this.medicationService.toggleMedicationStatus(medicationId);
      await loadUserMedications();
      try {
        const updatedMed = userMedications.find((m: any) => m.id === medicationId);
        if (updatedMed) await reminders.scheduleForMedication(updatedMed);
      } catch {}
      await refreshEHRData();
    } catch (error) {
      presentToast('Error updating status');
    }
  }
}