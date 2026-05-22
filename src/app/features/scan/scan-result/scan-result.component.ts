import { Component, OnInit, Input, ViewChild, Output, EventEmitter } from '@angular/core';
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
  
  // NEW: Event to notify the parent to show history
  @Output() backRequested = new EventEmitter<void>();

  isOpen: boolean = false;

  constructor() { }

  ngOnInit() {}

  openModal() {
    this.isOpen = true;
  }

  // UPDATED: This function is called by the new Back button in your HTML
  onBackToHistory() {
    this.modal?.dismiss();     // Closes the current result modal
    this.backRequested.emit(); // Tells the parent to open RecentScans
  }

  closeModal() {
    this.modal?.dismiss();
  }

  onDismiss() {
    this.isOpen = false;
  }
}