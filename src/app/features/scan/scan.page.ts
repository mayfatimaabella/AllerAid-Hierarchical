import { Component, ViewChild } from '@angular/core';
import { ProductService } from '../../core/services/product.service';
import { BarcodeService } from '../../core/services/barcode.service';
import { AllergyManagerService } from '../../core/services/allergy-manager.service';
import { ScanResultComponent } from './scan-result/scan-result.component';
import { AlertController } from '@ionic/angular';
//import { LocalStorageService } from '../../features/profile/services/local-storage.service';
import { StorageService } from '../../core/services/storage.service';

@Component({
  selector: 'app-scan',
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss'],
  standalone: false,
})
export class ScanPage {
  @ViewChild('scanResultModal') scanResultModal!: ScanResultComponent;
  @ViewChild('recentScansModal') recentScansModal!: any;

  manualBarcode: string = '';
  productInfo: any = null;
  allergenStatus: 'safe' | 'warning' | null = null;
  ingredientsToWatch: string[] = [];
  recentScans: any[] = [];
  isManualInputModalOpen: boolean = false;
  isRecentScansModalOpen: boolean = false;

  constructor(
    private productService: ProductService,
    private barcodeService: BarcodeService,
    private allergyManagerService: AllergyManagerService,
    //private localStorage: LocalStorageService,
    private storageService: StorageService,
    private alertCtrl: AlertController
  ) {}

  scanAndFetchProduct(barcode: string) {
    if (!barcode || barcode.trim() === '') {
      alert('Please enter a valid barcode.');
      return;
    }

    // Reset display state
    this.productInfo = null;
    this.allergenStatus = null;
    this.ingredientsToWatch = [];

    // Load user's actual allergies from Firebase
    this.allergyManagerService.loadUserAllergies().then(async (userAllergiesData: any[]) => {
      this.productService.getProduct(barcode).subscribe(async (data: any) => {
        if (data.status === 1) {
          const product = data.product;

          // Smarter product name selection
          const productName =
            product.product_name ||
            product.product_name_en ||
            product.generic_name ||
            product.product_name_de ||
            product.product_name_fr ||
            'Unnamed Product';

          // Set productInfo with fallback name
          this.productInfo = {
            ...product,
            product_name: productName,
          };

          // Get user's actual allergies from Firebase (only checked ones)
          const userAllergens: string[] = userAllergiesData.map((allergy: any) => allergy.name.toLowerCase());
          
          // Map allergy names to possible ingredient text matches
          const allergenSearchTerms: {[key: string]: string[]} = {
            'dairy': ['milk', 'dairy', 'whey', 'lactose', 'butter', 'ghee', 'cream', 'cheese', 'yogurt'],
            'peanuts': ['peanut', 'arachid'],
            'shellfish': ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'clam'],
            'eggs': ['egg', 'albumin', 'lecithin'],
            'wheat': ['wheat', 'gluten', 'barley', 'rye'],
            'fish': ['fish', 'anchovy', 'cod', 'salmon', 'tuna'],
            'soy': ['soy', 'soya'],
            'tree nut': ['nut', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'macadamia'],
            'pollen': ['pollen'],
            'latex': ['latex'],
            'animaldander': ['dander', 'pet', 'animal'],
            'insectstings': ['insect'],
            'medication': [],
            'others': ['chocolate']
          };

          // Extract ingredient/allergen data
          const ingredientsText = product.ingredients_text?.toLowerCase() || '';
          const allergensFromAPI = (product.allergens_tags || []).map((tag: string) =>
            tag.replace('en:', '').toLowerCase()
          );

          // Detect allergens from ingredients or API
          const matchedAllergens = userAllergens.filter(userAllergen => {
            const searchTerms = allergenSearchTerms[userAllergen] || [userAllergen];
            return searchTerms.some(term => 
              ingredientsText.includes(term) || allergensFromAPI.includes(term)
            );
          });

          // Determine allergen status
          if (matchedAllergens.length > 0) {
            this.allergenStatus = 'warning';
            this.ingredientsToWatch = matchedAllergens;
          } else if (!ingredientsText && allergensFromAPI.length === 0) {
            this.allergenStatus = 'warning';
            this.ingredientsToWatch = ['Caution: We couldnt find the ingredient list for this item. Please check the label.'];
          } else {
            this.allergenStatus = 'safe';
            this.ingredientsToWatch = ['Safe to Consume'];
          }

          // Add to Recent Scans
          const scanEntry = {
            code: product.code || barcode,
            product_name: productName,
            brand: product.brands || 'Unknown Brand',
            status: this.allergenStatus,
            allergens: this.ingredientsToWatch,
            date: new Date().toISOString(),
            image_url: product.image_url || 'assets/img/placeholder.png',
          };

          // Add to temporary recent scans (in-memory)
          //this.recentScans.unshift(scanEntry);
          //this.recentScans = this.recentScans.slice(0, 10); // limit to last 10

          await this.storageService.addRecentScan(scanEntry);
          this.recentScans = await this.storageService.getRecentScans();

          // Open the modal with the scan result
          this.openScanResultModal();

          // Debug logs
          console.log('Product:', productName);
          console.log('User Allergens:', userAllergens);
          console.log('Matched Allergens:', this.ingredientsToWatch);
          console.log('Status:', this.allergenStatus);
          console.log('Recent Scans:', this.recentScans);

        } else {
          alert('Product not found in OpenFoodFacts.');
          this.productInfo = null;
          this.allergenStatus = null;
          this.ingredientsToWatch = [];
        }
      });
    });
  }

  // Open the scan result modal
  openScanResultModal() {
    if (this.scanResultModal) {
      this.scanResultModal.openModal();
    }
  }

  // Camera scanning
  async startCameraScan() {
    try {
      console.log('=== SCAN PAGE: Starting camera scan ===');

      const scannedBarcode = await this.barcodeService.scanBarcode();

      if (scannedBarcode) {
        console.log('=== SCAN PAGE: Scanned barcode received ===', scannedBarcode);
        this.scanAndFetchProduct(scannedBarcode);
        this.manualBarcode = scannedBarcode;
      } else {
        console.log('=== SCAN PAGE: No barcode scanned or scan cancelled ===');
      }
    } catch (error) {
      console.error('=== SCAN PAGE: Error during barcode scan ===', error);
    }
  }

  viewScan(scan: any) {
    this.productInfo = {
      product_name: scan.product_name,
      brands: scan.brand,
      ingredients_text: 'Ingredients unavailable — viewed from recent scans.',
      image_url: scan.image_url,
    };
    this.allergenStatus = scan.status;
    this.ingredientsToWatch = scan.allergens || [];

    // Open the modal
    this.openScanResultModal();
  }

  openManualInputModal() {
    this.isManualInputModalOpen = true;
  }

  viewRecentScans() {
    if (this.recentScansModal) {
      this.recentScansModal.openModal();
    }
  }

  onBarcodeSubmitted(barcode: string) {
    this.scanAndFetchProduct(barcode);
    this.isManualInputModalOpen = false;
  }

  onRecentScanSelected(scan: any) {
    this.viewScan(scan);
    this.recentScansModal.onDismiss();
  }

  async confirmDeleteScan(index: number) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Scan',
      message: 'Are you sure you want to remove this product from recent scans?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: async () => {
            await this.storageService.deleteRecentScan(index);
            this.recentScans = await this.storageService.getRecentScans();
          }
        }
      ]
    });
  
    await alert.present();
  }

  async clearRecentScans() {
    const alert = await this.alertCtrl.create({
      header: 'Clear All Scans',
      message: 'Remove all recent scans?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear',
          handler: async () => {
            await this.storageService.clearRecentScans();
            this.recentScans = [];
          }
        }
      ]
    });
  
    await alert.present();
  }

async ionViewWillEnter() {
  this.recentScans = await this.storageService.getRecentScans();
}

}
