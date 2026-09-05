import { Component, OnInit } from '@angular/core';
import {
  WatchConnection,
  WatchConnectionResult
} from 'src/app/core/services/watch.service';

@Component({
  selector: 'app-smartwatch',
  templateUrl: './smartwatch.page.html',
  styleUrls: ['./smartwatch.page.scss'],
  standalone: false,
})
export class SmartwatchPage implements OnInit {

  connected = false;
  watchName = '';

  constructor() {}

  ngOnInit(): void {
    this.checkConnection();
  }

  async checkConnection(): Promise<void> {
    try {
      const result: WatchConnectionResult =
        await WatchConnection.isConnected();

      console.log('Watch connection result:', JSON.stringify(result, null, 2));

      this.connected = result.connected;

      if (result.connected) {
        this.watchName =
          result.name?.trim() || 'Compatible Smartwatch';
      } else {
        this.watchName = '';
      }

    } catch (error) {
      console.error(
        'Unable to check smartwatch connection:',
        error
      );

      this.connected = false;
      this.watchName = '';
    }
  }

  async testConnection(): Promise<void> {
    await this.checkConnection();

    if (this.connected) {
      console.log(
        `Smartwatch connected: ${this.watchName}`
      );
    } else {
      console.log(
        'No compatible smartwatch is connected.'
      );
    }
  }
}