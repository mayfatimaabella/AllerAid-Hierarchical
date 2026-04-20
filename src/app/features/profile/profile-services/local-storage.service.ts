import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  private storageInstance: Storage | null = null;

  constructor(private storage: Storage) {}

  async init() {
    if (!this.storageInstance) {
      this.storageInstance = await this.storage.create();
    }
  }

  async set(key: string, value: any) {
    await this.init();
    return this.storageInstance?.set(key, value);
  }

  async get(key: string) {
    await this.init();
    return this.storageInstance?.get(key);
  }

  async remove(key: string) {
    await this.init();
    return this.storageInstance?.remove(key);
  }

  async clear() {
    await this.init();
    return this.storageInstance?.clear();
  }
}
