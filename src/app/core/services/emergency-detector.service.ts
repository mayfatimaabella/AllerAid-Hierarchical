import { Injectable, NgZone } from '@angular/core';
import { EmergencyAlertService } from './emergency-alert.service';
import { AuthService } from './auth.service';
import { Platform } from '@ionic/angular';
import { EmergencySettingsService, EmergencySettings } from './emergency-settings.service';

@Injectable({
  providedIn: 'root'
})
export class EmergencyDetectorService {
  
  private isShakeDetectionActive = false;
  private isVolumeButtonDetectionActive = false;
  
  private lastShakeTime = 0;
  private shakeThreshold = 15;
  private shakeTimeThreshold = 300;
  private shakeCount = 0;
  private shakeDetectionWindow = 2000;
  private shakeWindowTimer: any = null;

  private lastShakeEmergencyTime = 0;
  private shakeEmergencyCooldown = 60000;
  
  private volumeButtonPresses = 0;
  private volumeButtonTimer: any = null;
  private volumeButtonWindow = 2000;
  
  private emergencySettings: EmergencySettings = {
    shakeToAlert: false,
    powerButtonAlert: false,
    audioInstructions: true
  };
  
  constructor(
    private emergencyAlertService: EmergencyAlertService,
    private authService: AuthService,
    private platform: Platform,
    private ngZone: NgZone,
    private emergencySettingsService: EmergencySettingsService
  ) {
    this.initializeDetectors();
  }
  
  private async initializeDetectors() {
    await this.platform.ready();
    await this.loadEmergencySettings();
    this.setupShakeDetection();
    this.setupPowerButtonDetection();
    console.log('Emergency detector service initialized');
  }
  
  async loadEmergencySettings(): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (currentUser) {
        const settings = await this.emergencySettingsService.getEmergencySettings(currentUser.uid);
        if (settings) {
          this.emergencySettings = { ...this.emergencySettings, ...settings };
          console.log('Loaded emergency settings:', this.emergencySettings);
          this.updateDetectorStates();
        }
      }
    } catch (error) {
      console.error('Error loading emergency settings:', error);
    }
  }
  
  async updateEmergencySettings(newSettings: EmergencySettings): Promise<void> {
    this.emergencySettings = { ...newSettings };
    this.updateDetectorStates();
    console.log('Updated emergency settings:', this.emergencySettings);
  }
  
  private updateDetectorStates(): void {
    this.isShakeDetectionActive = this.emergencySettings.shakeToAlert;
    this.isVolumeButtonDetectionActive = this.emergencySettings.powerButtonAlert;
    console.log('Detector states updated:', {
      shake: this.isShakeDetectionActive,
      volumeButton: this.isVolumeButtonDetectionActive
    });
  }
  
  private setupShakeDetection(): void {
    if (!window.DeviceMotionEvent) {
      console.warn('DeviceMotion not supported on this device');
      return;
    }
    
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      (DeviceMotionEvent as any).requestPermission()
        .then((permissionState: string) => {
          if (permissionState === 'granted') {
            this.startShakeListening();
          } else {
            console.warn('Device motion permission denied');
          }
        })
        .catch(console.error);
    } else {
      this.startShakeListening();
    }
  }
  
  private startShakeListening(): void {
    window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
      if (!this.isShakeDetectionActive) return;
      
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;
      
      const x = acceleration.x || 0;
      const y = acceleration.y || 0;
      const z = acceleration.z || 0;
      const totalAcceleration = Math.sqrt(x * x + y * y + z * z);

      if (totalAcceleration <= this.shakeThreshold) return;

      const currentTime = Date.now();

      if (currentTime - this.lastShakeTime < this.shakeTimeThreshold) return;

      this.lastShakeTime = currentTime;

      if (!this.shakeWindowTimer) {
        this.shakeCount = 0;
        this.shakeWindowTimer = setTimeout(() => {
          this.shakeCount = 0;
          this.shakeWindowTimer = null;
        }, this.shakeDetectionWindow);
      }

      this.shakeCount++;

      if (this.shakeCount >= 3) {
        clearTimeout(this.shakeWindowTimer);
        this.shakeWindowTimer = null;
        this.shakeCount = 0;

        const sinceLastEmergency = currentTime - this.lastShakeEmergencyTime;
        if (sinceLastEmergency < this.shakeEmergencyCooldown) {
          console.log('Shake emergency ignored due to cooldown');
          return;
        }

        this.lastShakeEmergencyTime = currentTime;
        this.ngZone.run(() => { this.triggerShakeEmergency(); });
      }
    });
    
    console.log('Shake detection listener activated (requires 3 shakes with cooldown)');
  }
  
  private setupPowerButtonDetection(): void {
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this.isVolumeButtonDetectionActive) return;
      if (this.isPowerButtonKey(event)) {
        this.handlePowerButtonPress();
      }
    });
    console.log('Volume button detection listener activated');
  }
  
  private isPowerButtonKey(event: KeyboardEvent): boolean {
    const volumeButtonCodes = ['VolumeUp', 'VolumeDown', 24, 25];
    return volumeButtonCodes.includes(event.code) || 
           volumeButtonCodes.includes(event.key) || 
           volumeButtonCodes.includes(event.keyCode);
  }
  
  private handlePowerButtonPress(): void {
    this.volumeButtonPresses++;
    
    if (this.volumeButtonTimer) {
      clearTimeout(this.volumeButtonTimer);
    }
    
    if (this.volumeButtonPresses >= 3) {
      this.ngZone.run(() => { this.triggerPowerButtonEmergency(); });
      this.volumeButtonPresses = 0;
      return;
    }
    
    this.volumeButtonTimer = setTimeout(() => {
      this.volumeButtonPresses = 0;
    }, this.volumeButtonWindow);
  }
  
  private async triggerShakeEmergency(): Promise<void> {
    try {
      console.log('Shake emergency detected!');
      await this.emergencyAlertService.triggerEmergencyAlert('shake');
    } catch (error) {
      console.error('Error triggering shake emergency:', error);
    }
  }
  
  private async triggerPowerButtonEmergency(): Promise<void> {
    try {
      console.log('Volume button emergency detected!');
      await this.emergencyAlertService.triggerEmergencyAlert('power-button');
    } catch (error) {
      console.error('Error triggering power button emergency:', error);
    }
  }
  
  async testShakeDetection(): Promise<void> {
    console.log('Testing shake detection...');
    if (this.emergencySettings.shakeToAlert) {
      await this.triggerShakeEmergency();
    } else {
      console.log('Shake detection is disabled');
    }
  }
  
  async testPowerButtonDetection(): Promise<void> {
    console.log('Testing power button detection...');
    if (this.emergencySettings.powerButtonAlert) {
      await this.triggerPowerButtonEmergency();
    } else {
      console.log('Power button detection is disabled');
    }
  }
  
  getEmergencySettings(): EmergencySettings {
    return { ...this.emergencySettings };
  }
  
  isAudioInstructionsEnabled(): boolean {
    return this.emergencySettings.audioInstructions;
  }
  
  setShakeDetectionActive(active: boolean): void {
    this.isShakeDetectionActive = active;
  }
  
  setPowerButtonDetectionActive(active: boolean): void {
    this.isVolumeButtonDetectionActive = active;
  }
  
  async requestMotionPermissions(): Promise<boolean> {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        return permission === 'granted';
      } catch (error) {
        console.error('Error requesting motion permission:', error);
        return false;
      }
    }
    return true;
  }
}