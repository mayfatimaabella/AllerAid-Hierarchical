import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AlertController } from '@ionic/angular';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

@Injectable({
  providedIn: 'root'
})
export class BarcodeService {

  constructor(private alertController: AlertController) {}

  /**
   * Comprehensive diagnostic function to identify the exact problem
   */
  async diagnoseBarcodeIssues(): Promise<void> {
    console.log('=== BARCODE DIAGNOSTIC START ===');
    
    try {
      // 1. Platform check
      console.log('Platform:', Capacitor.getPlatform());
      console.log('Is native platform:', Capacitor.isNativePlatform());
      
      // 2. Plugin availability
      try {
        console.log('BarcodeScanner plugin available:', typeof BarcodeScanner);
      } catch (e) {
        console.error('BarcodeScanner plugin not found:', e);
        await this.showAlert('Plugin Error', 'BarcodeScanner plugin is not properly installed');
        return;
      }
      
      // 3. Permission check
      try {
        const permissions = await BarcodeScanner.requestPermissions();
        console.log('Camera permissions:', permissions);
      } catch (e) {
        console.error('Permission check failed:', e);
      }
      
      // 4. Module availability check
      try {
        const moduleResult = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        console.log('Module check result:', moduleResult);
        const isAvailable = typeof moduleResult === 'boolean' ? moduleResult : moduleResult.available;
        console.log('Module available:', isAvailable);
      } catch (e) {
        console.error('Module availability check failed:', e);
      }
      
      // 5. Try simple scan without module dependency
      try {
        console.log('Testing simple scan...');
        const result = await BarcodeScanner.scan({ formats: [] });
        console.log('Simple scan result:', result);
      } catch (e) {
        console.error('Simple scan failed:', e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        
        // Analyze error
        if (errorMsg.includes('MODULE_NOT_AVAILABLE')) {
          await this.showAlert('Diagnosis', 'Problem: Google Barcode Scanner module is not installed. This is common on emulators or first app launch.');
        } else if (errorMsg.includes('PERMISSION_DENIED')) {
          await this.showAlert('Diagnosis', 'Problem: Camera permission denied. Please enable camera access in settings.');
        } else if (errorMsg.includes('CAMERA_NOT_AVAILABLE')) {
          await this.showAlert('Diagnosis', 'Problem: Camera not available. Are you running on an emulator?');
        } else {
          await this.showAlert('Diagnosis', `Problem identified: ${errorMsg}`);
        }
      }
      
    } catch (error) {
      console.error('Diagnostic failed:', error);
      await this.showAlert('Diagnostic Error', `Failed to run diagnostics: ${error}`);
    }
    
    console.log('=== BARCODE DIAGNOSTIC END ===');
  }

  /**
   * Alternative scan method without Google module dependency
   */
  async scanBarcodeSimple(): Promise<string | null> {
    console.log('=== SIMPLE BARCODE SCAN START ===');
    
    if (!Capacitor.isNativePlatform()) {
      await this.showAlert('Not Available', 'Barcode scanning only works on mobile devices. Please use manual input.');
      return null;
    }

    try {
      // Request permissions
      const permissions = await BarcodeScanner.requestPermissions();
      if (permissions.camera !== 'granted') {
        await this.showAlert('Permission Required', 'Camera permission is required for barcode scanning.');
        return null;
      }

      // Try scanning without checking module availability first
      console.log('Attempting direct barcode scan...');
      const result = await BarcodeScanner.scan({
        formats: [], // All formats
      });
      
      if (result.barcodes && result.barcodes.length > 0) {
        const scannedCode = result.barcodes[0].rawValue;
        console.log('Barcode scanned:', scannedCode);
        return scannedCode;
      }
      
      console.log('No barcode detected');
      return null;
      
    } catch (error) {
      console.error('Simple scan error:', error);
      return null;
    }
  }

  /**
   * Check if Google Barcode Scanner module is available
   */
  async isModuleAvailable(): Promise<boolean> {
    try {
      if (!Capacitor.isNativePlatform()) {
        return false;
      }
      const result = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      // Handle both possible return types
      return typeof result === 'boolean' ? result : result.available;
    } catch (error) {
      console.error('Error checking module availability:', error);
      return false;
    }
  }

  /**
   * Ensure Google Barcode Scanner module is installed
   */
  async ensureModuleInstalled(): Promise<boolean> {
    console.log('=== CHECKING MODULE INSTALLATION ===');
    
    try {
      const result = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      // Handle both possible return types
      const isAvailable = typeof result === 'boolean' ? result : result.available;
      console.log('Module currently available:', isAvailable);
      
      if (isAvailable) {
        console.log('Module already installed');
        return true;
      }
      
      console.log('Module not available - starting installation...');
      
      // Show installation alert
      const installAlert = await this.alertController.create({
        header: 'Installing Barcode Scanner',
        message: 'Installing the barcode scanner module. This requires internet connection and may take a few moments...',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              console.log('User cancelled module installation');
              return false;
            }
          }
        ]
      });
      await installAlert.present();
      
      // Install the module
      const progressListener = await BarcodeScanner.addListener(
        'googleBarcodeScannerModuleInstallProgress',
        (event) => {
          console.log('Installation progress:', event.progress, '%');
        }
      );
      
      await BarcodeScanner.installGoogleBarcodeScannerModule();
      progressListener.remove();
      await installAlert.dismiss();
      
      // Verify installation
      const verifyResult = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      const isNowAvailable = typeof verifyResult === 'boolean' ? verifyResult : verifyResult.available;
      console.log('Module installation completed. Available:', isNowAvailable);
      
      if (isNowAvailable) {
        await this.showAlert('Installation Complete', 'Barcode scanner module installed successfully! You can now scan barcodes.');
        return true;
      } else {
        throw new Error('Module installation completed but module still not available');
      }
      
    } catch (error) {
      console.error('Module installation failed:', error);
      await this.showAlert('Installation Failed', 'Failed to install barcode scanner module. Please check your internet connection and try again.');
      return false;
    }
  }

  /**
   * Scan barcode and return result
   */
  async scanBarcode(): Promise<string | null> {
    console.log('=== BARCODE SCAN DEBUG START ===');
    console.log('Platform check:', Capacitor.getPlatform());
    console.log('Is native platform:', Capacitor.isNativePlatform());
    
    if (!Capacitor.isNativePlatform()) {
      console.log('Not on native platform - showing alert');
      await this.showAlert('Not Available', 'Barcode scanning only works on mobile devices. For testing, please use the manual barcode input field below.');
      return null;
    }

    try {
      console.log('Starting barcode scan process...');
      
      // Request permissions first
      console.log('Requesting camera permissions...');
      const permissions = await BarcodeScanner.requestPermissions();
      console.log('Permission result:', permissions);
      
      if (permissions.camera !== 'granted') {
        console.log('Camera permission denied');
        await this.showAlert('Permission Required', 'Camera permission is required for barcode scanning. Please enable camera access in your device settings.');
        return null;
      }

      console.log('Camera permission granted, ensuring module is installed...');
      
      // Ensure module is installed
      const moduleReady = await this.ensureModuleInstalled();
      if (!moduleReady) {
        console.log('Module installation failed or was cancelled');
        return null;
      }

      console.log('Module is ready, starting camera scan...');
      
      // Start scanning with camera UI
      const result = await BarcodeScanner.scan({
        formats: [], // Empty array means all formats are supported
      });
      
      console.log('Scan result received:', result);
      console.log('Number of barcodes found:', result.barcodes ? result.barcodes.length : 0);
      
      if (result.barcodes && result.barcodes.length > 0) {
        const scannedCode = result.barcodes[0].rawValue;
        console.log('Barcode successfully scanned:', scannedCode);
        console.log('Barcode format:', result.barcodes[0].format);
        console.log('=== BARCODE SCAN DEBUG END ===');
        return scannedCode;
      }
      
      console.log('No barcode detected in scan result');
      console.log('=== BARCODE SCAN DEBUG END ===');
      return null;

    } catch (error) {
      console.error('Barcode scan error occurred:', error);
      console.log('Error type:', typeof error);
      console.log('Error details:', JSON.stringify(error, null, 2));
      
      // Check if user cancelled
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as any).message.toLowerCase();
        console.log('Error message (lowercase):', errorMessage);
        
        if (errorMessage.includes('cancelled') || errorMessage.includes('canceled') || errorMessage.includes('user_canceled')) {
          console.log('User cancelled scan - this is normal');
          console.log('=== BARCODE SCAN DEBUG END ===');
          return null;
        }
        
        // Handle specific error cases
        if (errorMessage.includes('module_not_available') || errorMessage.includes('module is not available')) {
          console.log('Module not available error detected');
          await this.showAlert('Module Installation Required', 'The barcode scanner module needs to be installed. Please tap "Tap to Scan" again to install it.');
          console.log('=== BARCODE SCAN DEBUG END ===');
          return null;
        }
        
        if (errorMessage.includes('permission')) {
          console.log('Permission error detected');
          await this.showAlert('Permission Denied', 'Camera permission is required for barcode scanning. Please enable camera access in your device settings.');
          console.log('=== BARCODE SCAN DEBUG END ===');
          return null;
        }
        
        if (errorMessage.includes('google play services')) {
          console.log('Google Play Services error detected');
          await this.showAlert('Google Play Services Required', 'Please update Google Play Services to use barcode scanning.');
          console.log('=== BARCODE SCAN DEBUG END ===');
          return null;
        }
      }
      
      console.log('Unhandled error - showing generic message');
      await this.showAlert('Scan Failed', `Barcode scanning failed: ${error}. Please try again or use manual barcode input.`);
      console.log('=== BARCODE SCAN DEBUG END ===');
      return null;
    }
  }

  /**
   * Check if product contains user's allergens using OpenFoodFacts API
   */
  async checkProductForAllergens(barcode: string, userAllergens: string[]): Promise<{
    status: 'safe' | 'warning' | 'contains_allergen';
    matchingAllergens: string[];
    productName?: string;
    ingredients?: string;
  }> {
    try {
      // Fetch product data from OpenFoodFacts API
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status !== 1) {
        // Product not found, return unknown status
        return {
          status: 'warning',
          matchingAllergens: [],
          productName: 'Unknown Product',
          ingredients: 'Product information not available'
        };
      }

      const product = data.product;
      const productName = product.product_name || 'Unnamed Product';
      const ingredients = product.ingredients_text || '';
      const allergens = product.allergens || '';
      
      // Combine ingredients and allergens for checking
      const productText = `${ingredients} ${allergens}`.toLowerCase();
      
      // Find matching allergens
      const matchingAllergens = userAllergens.filter(allergen => {
        const allergenLower = allergen.toLowerCase();
        return productText.includes(allergenLower) || 
               productText.includes(allergenLower.replace(/s$/, '')) || // singular form
               productText.includes(`${allergenLower}s`); // plural form
      });

      // Determine alert level
      let status: 'safe' | 'warning' | 'contains_allergen';
      
      if (matchingAllergens.length === 0) {
        status = 'safe';
      } else {
        // Check if it's a severe allergen (peanuts, shellfish, etc.)
        const severeAllergens = ['peanuts', 'shellfish', 'tree nuts', 'eggs', 'dairy', 'milk'];
        const hasSevereAllergen = matchingAllergens.some(allergen => 
          severeAllergens.some(severe => allergen.toLowerCase().includes(severe))
        );
        
        status = hasSevereAllergen ? 'contains_allergen' : 'warning';
      }

      // Show appropriate alert
      await this.showAllergenAlert(status, matchingAllergens, productName);

      return {
        status,
        matchingAllergens,
        productName,
        ingredients
      };

    } catch (error) {
      console.error('Error checking allergens:', error);
      await this.showAlert('Error', 'Unable to check product allergens. Please try again.');
      
      return {
        status: 'warning',
        matchingAllergens: [],
        productName: 'Unknown Product',
        ingredients: 'Error loading product data'
      };
    }
  }

  /**
   * Show allergen alert based on detection level
   */
  private async showAllergenAlert(status: 'safe' | 'warning' | 'contains_allergen', allergens: string[], productName: string): Promise<void> {
    let header: string;
    let message: string;
    let cssClass: string;

    switch (status) {
      case 'safe':
        header = 'SAFE TO CONSUME';
        message = `${productName} appears safe based on your allergy profile. No known allergens detected.`;
        cssClass = 'alert-success';
        break;

      case 'warning':
        header = 'WARNING - CHECK INGREDIENTS';
        message = `${productName} may contain: ${allergens.join(', ')}. Please check the full ingredient list carefully.`;
        cssClass = 'alert-warning';
        break;

      case 'contains_allergen':
        header = 'DANGER - CONTAINS ALLERGENS';
        message = `${productName} contains known allergens: ${allergens.join(', ')}. DO NOT CONSUME!`;
        cssClass = 'alert-danger';
        break;
    }

    const alert = await this.alertController.create({
      header,
      message,
      cssClass,
      buttons: [
        {
          text: 'View Details',
          handler: () => {
            // Could open detailed ingredient view
            console.log('Show detailed ingredients for:', productName);
          }
        },
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });

    await alert.present();
  }

  private async showAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}

