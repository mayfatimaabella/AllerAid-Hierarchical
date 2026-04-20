import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-manual-barcode',
  templateUrl: './manual-barcode.component.html',
  styleUrls: ['./manual-barcode.component.scss'],
  standalone: false,
})
export class ManualBarcodeComponent {
  @Output() barcodeSubmitted = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  manualBarcode: string = '';

  onSubmit() {
    // 1. Trim the barcode to prevent "fake" duplicates caused by whitespace
    const cleanedBarcode = this.manualBarcode ? this.manualBarcode.trim() : '';

    if (!cleanedBarcode) {
      alert('Please enter a valid barcode.');
      return;
    }

    // 2. Emit the cleaned version
    this.barcodeSubmitted.emit(cleanedBarcode);
    
    // Reset and close
    this.closeModal();
  }

  closeModal() {
    this.manualBarcode = '';
    this.close.emit();
  }
}