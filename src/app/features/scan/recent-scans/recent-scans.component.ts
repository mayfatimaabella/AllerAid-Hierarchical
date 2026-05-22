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
  
  // TRACKS NAVIGATION STATE: 
  // false = showing the history list
  // true = viewing a single product's detailed report
  isViewingProductDetails: boolean = false; 
  selectedProduct: any = null;

  // Open modal window
  openModal() {
    this.isOpen = true;
    this.isViewingProductDetails = false; // Always start fresh on the list view
    this.selectedProduct = null;
  }

  // Explicit close action (e.g., clicking an X icon or external cancel)
  closeModal() {
    this.modal?.dismiss();
  }

  // FIXED: Handles backdrop clicks and swipe-dismissals safely without causing recursion loops!
  onDismiss() {
    this.isOpen = false;
    this.isViewingProductDetails = false;
    this.selectedProduct = null;
    this.close.emit();
  }

  // NAVIGATION FIX: When clicking an item, flip the view state instead of shutting the modal down
  onScanSelected(scan: any) {
    this.selectedProduct = scan;
    this.isViewingProductDetails = true;
    this.scanSelected.emit(scan);
  }

  // NAVIGATION FIX: Smoothly return back to the list layout without resetting everything
  onGoBackToList() {
    this.isViewingProductDetails = false;
    this.selectedProduct = null;
  }

  // Delete specific scan entry instance
  onDeleteScan(index: number, event: Event) {
    event.stopPropagation(); // Prevents triggering background item selection click
    this.deleteScan.emit(index);
    
    // Fall back to main view screen if they deleted the item they were actively inspecting
    if (this.recentScans.length === 0) {
      this.onGoBackToList();
    }
  }

  // Clear all scans
  onClearScans() {
    this.clearScans.emit();
    this.onGoBackToList();
  }
}