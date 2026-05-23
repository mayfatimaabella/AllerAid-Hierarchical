import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor(private authService: AuthService) {}

  /* ===============================
   * Convert file to Base64 (for Firestore storage)
   * =============================== */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (error) => {
        console.error('File read error:', error);
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  /* ===============================
   * Upload License as Base64 (stored in Firestore)
   * =============================== */
  async uploadLicense(file: File, userId: string): Promise<string> {
    try {
      const base64String = await this.fileToBase64(file);
      
      // Validate size (Firestore has ~1MB limit per field, be conservative with 500KB)
      const sizeInBytes = base64String.length * 0.75; // Approximate base64 size
      const maxSizeBytes = 500 * 1024; // 500KB limit for safety
      
      if (sizeInBytes > maxSizeBytes) {
        throw new Error(`File too large. Maximum size is 500KB. Current size: ${(sizeInBytes / 1024).toFixed(2)}KB`);
      }
      
      return base64String;
    } catch (error) {
      console.error('License conversion error:', error);
      throw new Error(`Failed to process license: ${error}`);
    }
  }

  /* ===============================
   * Recent Scans (LOCAL STORAGE - USER SPECIFIC)
   * =============================== */

  private getRecentScansKey(): string {
    // FIXED: Added () to call the getCurrentUser method
    const userId = this.authService.getCurrentUser()?.uid || 'guest';
    return `recent_scans_${userId}`;
  }

  async getRecentScans(): Promise<any[]> {
    const key = this.getRecentScansKey();
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  async addRecentScan(scan: any): Promise<void> {
    const key = this.getRecentScansKey();
    let scans = await this.getRecentScans();

    // 1. Find the index of an existing scan with the same barcode 'code'
    const existingIndex = scans.findIndex(s => s.code === scan.code);

    // 2. If it exists, remove it so we can re-insert it at the top
    if (existingIndex !== -1) {
      scans.splice(existingIndex, 1);
    }

    // 3. Add the new scan to the beginning of the array
    scans.unshift({
      ...scan,
      timestamp: Date.now() // Always refresh timestamp for the "Recent" sort order
    });

    // 4. Keep only the latest 10 scans and save
    localStorage.setItem(
      key,
      JSON.stringify(scans.slice(0, 10))
    );
  }

  async deleteRecentScan(index: number): Promise<void> {
    const key = this.getRecentScansKey();
    const scans = await this.getRecentScans();
    if (index > -1 && index < scans.length) {
      scans.splice(index, 1);
      localStorage.setItem(key, JSON.stringify(scans));
    }
  }

  async clearRecentScans(): Promise<void> {
    const key = this.getRecentScansKey();
    localStorage.removeItem(key);
  }
}