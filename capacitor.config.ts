import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alleraid.app',
  appName: 'AllerAid',
  webDir: 'www',
  plugins: {
    '@capacitor-mlkit/barcode-scanning': {
      formats: [
        'QR_CODE', 
        'EAN_13', 
        'EAN_8', 
        'UPC_A', 
        'UPC_E', 
        'CODE_128', 
        'CODE_39', 
        'CODE_93', 
        'CODABAR', 
        'ITF', 
        'RSS14', 
        'RSS_EXPANDED', 
        'PDF_417', 
        'AZTEC', 
        'DATA_MATRIX'
      ]
    }
  }
};

export default config;