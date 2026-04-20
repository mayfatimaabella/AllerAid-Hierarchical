import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

@Component({
  selector: 'app-image-viewer',
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="dismiss()" fill="clear">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <div class="image-container">
        <img [src]="imageUrl" alt="{{ title }}" style="width: 100%; height: auto; border-radius: 8px;">
      </div>
      
      <div style="margin-top: 16px; text-align: center;">
        <ion-button fill="outline" (click)="downloadImage()">
          <ion-icon name="download-outline" slot="start"></ion-icon>
          Download Image
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .image-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 300px;
    }
    
    img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
  `],
  standalone: false,
})
export class ImageViewerModal {
  @Input() imageUrl: string = '';
  @Input() title: string = '';
  @Input() fileName: string = '';

  constructor(private modalController: ModalController) {}

  dismiss() {
    this.modalController.dismiss();
  }

  downloadImage() {
    if (this.imageUrl) {
      const link = document.createElement('a');
      link.href = this.imageUrl;
      link.download = this.fileName || 'medication-image.jpg';
      link.click();
    }
  }
}
