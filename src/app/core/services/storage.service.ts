import { Injectable } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private storage = getStorage(initializeApp(environment.firebaseConfig));

  constructor(private authService: AuthService) {}

  /* ===============================
   * Firebase upload (UNCHANGED)
   * =============================== */
  async uploadLicense(file: File, userId: string): Promise<string> {
    const fileRef = ref(this.storage, `licenses/${userId}/${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
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