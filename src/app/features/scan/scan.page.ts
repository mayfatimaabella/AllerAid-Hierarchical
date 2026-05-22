import { Component, ViewChild } from '@angular/core';
import { ProductService } from '../../core/services/product.service';
import { BarcodeService } from '../../core/services/barcode.service';
import { AllergyManagerService } from '../../core/services/allergy-manager.service';
import { ScanResultComponent } from './scan-result/scan-result.component';
import { AlertController } from '@ionic/angular';
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

          // --- DATABASE FIRST UPDATE STEP 2: Pure mapping lookup dictionaries ---
          const allergenSearchTerms: { [key: string]: string[] } = {
            'dairy': ['milk', 'dairy', 'whey', 'lactose', 'butter', 'ghee', 'cream', 'cheese', 'yogurt'],
            'peanuts': ['peanuts', 'arachid', 'roasted peanuts', 'peanut butter'],
            'nuts': ['nuts', 'almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'macadamia', 'chestnut', 'hazelnut'],
            'shellfish': ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'clam'],
            'eggs': ['egg', 'albumin'],
            'wheat': ['wheat', 'gluten', 'barley', 'rye'],
            'fish': ['fish', 'anchovy', 'cod', 'salmon', 'tuna'],
            'soy': ['soy', 'soya', 'lecithin'],
            'pollen': ['pollen'],
            'latex': ['latex'],
            'animaldander': ['dander', 'pet', 'animal'],
            'insectstings': ['insect'],
            'medication': [],
            'others': []
          };

          // Extract and clean ingredients data text sets
          const ingredientsText = product.ingredients_text?.toLowerCase() || '';
          const allergensFromAPI = (product.allergens_tags || []).map((tag: string) =>
            tag.replace('en:', '').toLowerCase()
          );

          // Extract clean profile lookup keys match records 
          const userAllergens: string[] = userAllergiesData.map((allergy: any) => 
            allergy.name.toLowerCase().trim()
          );

          const matchedAllergensLabels: string[] = [];

          // Pure dynamic lookup mapping matches
          userAllergens.forEach((userAllergen) => {
            const searchTerms = allergenSearchTerms[userAllergen];
            let isMatched = false;

            if (searchTerms && searchTerms.length > 0) {
              // Check if any sub-dictionary term matches our text fields safely
              isMatched = searchTerms.some(term => 
                ingredientsText.includes(term.toLowerCase().trim()) || 
                allergensFromAPI.includes(term.toLowerCase().trim())
              );
            } else {
              // Fallback match condition for non-dictionary custom inputs
              isMatched = ingredientsText.includes(userAllergen) || 
                          allergensFromAPI.includes(userAllergen);
            }

            if (isMatched) {
              // Locate the matching allergy object to extract its readable name/label
              const originalAllergyObj = userAllergiesData.find(a => a.name.toLowerCase().trim() === userAllergen);
              
              // Ironclad fallback chain: Use label -> name property -> clean string tag directly
              const labelResult = originalAllergyObj?.label || originalAllergyObj?.name || userAllergen;
              
              if (!matchedAllergensLabels.includes(labelResult)) {
                matchedAllergensLabels.push(labelResult);
              }
            }
          });

          // Determine final allergen status variables
          if (matchedAllergensLabels.length > 0) {
            this.allergenStatus = 'warning';
            this.ingredientsToWatch = matchedAllergensLabels;
          } else if (!ingredientsText && allergensFromAPI.length === 0) {
            this.allergenStatus = 'warning';
            this.ingredientsToWatch = ['Caution: We couldn\'t find the ingredient list for this item. Please check the label.'];
          } else {
            this.allergenStatus = 'safe';
            this.ingredientsToWatch = ['Safe to Consume'];
          }

          // Build History Record Entry
          const scanEntry = {
            code: product.code || barcode,
            product_name: productName,
            brand: product.brands || 'Unknown Brand',
            status: this.allergenStatus,
            allergens: this.ingredientsToWatch,
            date: new Date().toISOString(),
            image_url: product.image_url || 'assets/img/placeholder.png',
          };

          await this.storageService.addRecentScan(scanEntry);
          this.recentScans = await this.storageService.getRecentScans();

          // Fire display window component modal
          this.openScanResultModal();

          // Debug logs
          console.log('Product:', productName);
          console.log('User Allergens:', userAllergens);
          console.log('Matched Allergens labels:', this.ingredientsToWatch);
          console.log('Status:', this.allergenStatus);

        } else {
          alert('Product not found in OpenFoodFacts.');
          this.productInfo = null;
          this.allergenStatus = null;
          this.ingredientsToWatch = [];
        }
      });
    });
  }

  openScanResultModal() {
    if (this.scanResultModal) {
      this.scanResultModal.openModal();
    }
  }

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