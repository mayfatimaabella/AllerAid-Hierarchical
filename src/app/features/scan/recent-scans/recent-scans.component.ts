import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { IonModal } from '@ionic/angular';

@Component({
  selector: 'app-recent-scans',
  templateUrl: './recent-scans.component.html',
  styleUrls: ['./recent-scans.component.scss'],
  standalone: false,
})
export class RecentScansComponent {

  @ViewChild(IonModal) modal!: IonModal;

  @Input() recentScans: any[] = [];

  @Output() scanSelected = new EventEmitter<any>();
  @Output() deleteScan = new EventEmitter<number>();
  @Output() clearScans = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  isOpen: boolean = false;

  // Open modal
  openModal() {
    this.isOpen = true;
  }

  // Close modal
  closeModal() {
    this.modal?.dismiss();
  }

  // Modal dismissed
  onDismiss() {
    this.isOpen = false;
    this.close.emit();
  }

  // When user selects scan
  onScanSelected(scan: any) {
    this.scanSelected.emit(scan);
    this.closeModal();
  }

  // Delete specific scan
  onDeleteScan(index: number, event: Event) {
    event.stopPropagation(); // prevents triggering item click
    this.deleteScan.emit(index);
  }

  // Clear all scans
  onClearScans() {
    this.clearScans.emit();
  }
}
