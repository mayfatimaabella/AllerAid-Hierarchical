import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
IonicModule,
AlertController,
ToastController
} from '@ionic/angular';

import {
AdminEmergencyHotlineService,
EmergencyHotline
} from '../../../core/services/admin/admin-emergency-hotline';

@Component({
selector: 'app-manage-emergency-hotlines',
templateUrl: './manage-emergency-hotlines.page.html',
styleUrls: ['./manage-emergency-hotlines.page.scss'],
standalone: true,
imports: [
CommonModule,
IonicModule,
FormsModule
]
})
export class ManageEmergencyHotlinesPage implements OnInit {


// HOTLINE DATA


hotlines: EmergencyHotline[] = [];

filtered: EmergencyHotline[] = [];

isLoading = false;

searchTerm = '';

activeFilter:
| 'all'
| 'active'
| 'inactive' = 'all';


// MODAL


isHotlineModalOpen = false;

modalMode:
| 'add'
| 'edit' = 'add';

editingHotline:
| EmergencyHotline
| null = null;


// FORM


form = {
name: '',
number: '',
order: 1,
isActive: true,
defaultEnabled: false
};


// CONSTRUCTOR


constructor(
private hotlineService: AdminEmergencyHotlineService,
private alertController: AlertController,
private toastController: ToastController
) {}


// LIFECYCLE


async ngOnInit(): Promise<void> {
await this.loadHotlines();
}

async ionViewWillEnter(): Promise<void> {
await this.loadHotlines();
}


// LOAD HOTLINES


async loadHotlines(): Promise<void> {

try {

  this.isLoading = true;

  this.hotlines =
    await this.hotlineService.getAllHotlines();

  this.applyFilters();

} catch (error) {

  console.error(
    'Load hotlines error:',
    error
  );

  await this.presentToast(
    'Failed to load hotlines.',
    'danger'
  );

} finally {

  this.isLoading = false;

}


}


// FILTER


setFilter(
filter:
| 'all'
| 'active'
| 'inactive'
): void {

this.activeFilter = filter;

this.applyFilters();


}

filterHotlines(): void {

this.applyFilters();


}

private applyFilters(): void {

let result =
  [...this.hotlines];



// STATUS FILTER


if (
  this.activeFilter === 'active'
) {

  result =
    result.filter(
      hotline =>
        hotline.isActive === true
    );

}


if (
  this.activeFilter === 'inactive'
) {

  result =
    result.filter(
      hotline =>
        hotline.isActive === false
    );

}



// SEARCH FILTER


const term =
  this.searchTerm
    .trim()
    .toLowerCase();


if (term) {

  result =
    result.filter(
      hotline =>

        hotline.name
          .toLowerCase()
          .includes(term)

        ||

        hotline.number
          .toLowerCase()
          .includes(term)
    );

}


this.filtered = result;


}


// GET INITIALS


getInitials(
name: string
): string {

return name
  ?.split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map(word => word[0])
  .join('')
  .toUpperCase()
  || '??';


}


// ADD HOTLINE


addHotline(): void {

this.modalMode = 'add';

this.editingHotline = null;


this.form = {

  name: '',

  number: '',

  order:
    this.hotlines.length + 1,

  isActive: true,

  defaultEnabled: false

};


this.isHotlineModalOpen = true;


}


// EDIT HOTLINE


editHotline(
hotline: EmergencyHotline
): void {

this.modalMode = 'edit';

this.editingHotline = hotline;


this.form = {

  name:
    hotline.name || '',

  number:
    hotline.number || '',

  order:
    hotline.order || 1,

  isActive:
    hotline.isActive !== false,

  defaultEnabled:
    hotline.defaultEnabled === true

};


this.isHotlineModalOpen = true;


}


// CLOSE HOTLINE MODAL


closeHotlineModal(): void {

this.isHotlineModalOpen = false;

this.editingHotline = null;


}


// SAVE HOTLINE


async saveHotline(): Promise<void> {

const name =
  this.form.name
    ?.trim();

const number =
  this.form.number
    ?.trim();

const order =
  Number(this.form.order);



// VALIDATE NAME


if (!name) {

  await this.presentToast(
    'Hotline name is required.',
    'warning'
  );

  return;

}



// VALIDATE NUMBER


if (!number) {

  await this.presentToast(
    'Hotline number is required.',
    'warning'
  );

  return;

}



// VALIDATE ORDER


if (
  !Number.isFinite(order)
  || order < 1
) {

  await this.presentToast(
    'Display order must be at least 1.',
    'warning'
  );

  return;

}


try {


  // ADD


  if (
    this.modalMode === 'add'
  ) {

    await this.hotlineService.addHotline({

      name,

      number,

      isActive:
        this.form.isActive,

      defaultEnabled:
        this.form.defaultEnabled,

      order

    });


    await this.presentToast(
      'Hotline added successfully.',
      'success'
    );

  }



  // EDIT


  else {

    if (
      !this.editingHotline
    ) {

      await this.presentToast(
        'Unable to identify the hotline.',
        'danger'
      );

      return;

    }


    await this.hotlineService.updateHotline(

      this.editingHotline.id,

      {

        name,

        number,

        order,

        isActive:
          this.form.isActive,

        defaultEnabled:
          this.form.defaultEnabled

      }

    );


    await this.presentToast(
      'Hotline updated successfully.',
      'success'
    );

  }


  // --------------------------------------------------------
  // CLOSE MODAL
  // --------------------------------------------------------

  this.closeHotlineModal();


  // --------------------------------------------------------
  // REFRESH DATA
  // --------------------------------------------------------

  await this.loadHotlines();


} catch (error) {

  console.error(
    'Save hotline error:',
    error
  );


  await this.presentToast(

    this.modalMode === 'add'

      ? 'Failed to add hotline.'

      : 'Failed to update hotline.',

    'danger'

  );

}


}


// TOGGLE ACTIVE


async toggleActive(
hotline: EmergencyHotline
): Promise<void> {

const next =
  !hotline.isActive;


const alert =
  await this.alertController.create({

    header:
      next
        ? 'Activate Hotline?'
        : 'Deactivate Hotline?',

    message:
      `Are you sure you want to ${
        next
          ? 'activate'
          : 'deactivate'
      } "${hotline.name}"?`,

    buttons: [

      {
        text: 'Cancel',
        role: 'cancel'
      },

      {

        text:
          next
            ? 'Activate'
            : 'Deactivate',

        handler: async () => {

          try {

            await this.hotlineService.updateHotline(

              hotline.id,

              {
                isActive: next
              }

            );


            await this.presentToast(

              `Hotline ${
                next
                  ? 'activated'
                  : 'deactivated'
              }.`,


              next
                ? 'success'
                : 'warning'

            );


            await this.loadHotlines();


          } catch (error) {

            console.error(
              'Toggle active error:',
              error
            );


            await this.presentToast(
              'Failed to update hotline.',
              'danger'
            );

          }

        }

      }

    ]

  });


await alert.present();


}


// TOGGLE DEFAULT


async toggleDefaultEnabled(
hotline: EmergencyHotline
): Promise<void> {

const next =
  !hotline.defaultEnabled;


try {

  await this.hotlineService.updateHotline(

    hotline.id,

    {
      defaultEnabled: next
    }

  );


  await this.presentToast(

    `Default ${
      next
        ? 'enabled'
        : 'disabled'
    } for "${hotline.name}".`,

    'success'

  );


  await this.loadHotlines();


} catch (error) {

  console.error(
    'Toggle default enabled error:',
    error
  );


  await this.presentToast(
    'Failed to update hotline.',
    'danger'
  );

}


}


// DELETE HOTLINE


async deleteHotline(
hotline: EmergencyHotline
): Promise<void> {

const alert =
  await this.alertController.create({

    header:
      'Delete Hotline?',

    message:
      `This will permanently remove "${hotline.name} (${hotline.number})".`,

    buttons: [

      {
        text: 'Cancel',
        role: 'cancel'
      },

      {

        text: 'Delete',

        role: 'destructive',

        handler: async () => {

          try {

            await this.hotlineService.deleteHotline(
              hotline.id
            );


            await this.presentToast(
              'Hotline deleted.',
              'warning'
            );


            await this.loadHotlines();


          } catch (error) {

            console.error(
              'Delete hotline error:',
              error
            );


            await this.presentToast(
              'Failed to delete hotline.',
              'danger'
            );

          }

        }

      }

    ]

  });


await alert.present();


}


// TOAST


async presentToast(
message: string,
color:
| 'success'
| 'warning'
| 'danger'
| 'medium' = 'medium'
): Promise<void> {

const toast =
  await this.toastController.create({

    message,

    duration: 2500,

    position: 'bottom',

    color

  });


await toast.present();


}

}