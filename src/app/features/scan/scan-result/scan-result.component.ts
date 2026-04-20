import { Component, OnInit, Input, ViewChild, ElementRef } from '@angular/core';
import { IonModal } from '@ionic/angular';

@Component({
  selector: 'app-scan-result',
  templateUrl: './scan-result.component.html',
  styleUrls: ['./scan-result.component.scss'],
  standalone: false,
})
export class ScanResultComponent implements OnInit {
  @ViewChild(IonModal) modal!: IonModal;

  @Input() productInfo: any = null;
  @Input() allergenStatus: 'safe' | 'warning' | null = null;
  @Input() ingredientsToWatch: string[] = [];

  isOpen: boolean = false;

  constructor() { }

  ngOnInit() {}

  openModal() {
    this.isOpen = true;
  }

  closeModal() {
    this.modal?.dismiss();
  }

  onDismiss() {
    this.isOpen = false;
  }

}
