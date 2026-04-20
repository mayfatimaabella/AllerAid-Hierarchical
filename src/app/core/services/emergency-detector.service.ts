import { Injectable, NgZone } from '@angular/core';
import { EmergencyAlertService } from './emergency-alert.service';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { Platform } from '@ionic/angular';

export interface EmergencySettings {
  shakeToAlert: boolean;
  powerButtonAlert: boolean; // Stored as powerButtonAlert in profile, used for volume button alert
  audioInstructions: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class EmergencyDetectorService {
  
  private isShakeDetectionActive = false;
  private isVolumeButtonDetectionActive = false;
  
  // Shake detection variables
  private lastShakeTime = 0; // Timestamp of last counted shake event (for debouncing)
  private shakeThreshold = 15; // Acceleration threshold for a single shake
  private shakeTimeThreshold = 300; // Minimum time between counting separate shakes (ms)
  private shakeCount = 0; // Number of shakes detected in the current window
  private shakeDetectionWindow = 2000; // Time window to detect multiple shakes (ms)
  private shakeWindowTimer: any = null;

  // Shake emergency rate limiting
  private lastShakeEmergencyTime = 0; // Timestamp of last shake-triggered emergency
  private shakeEmergencyCooldown = 60000; // Minimum time between shake emergencies (ms)
  
  // Volume button detection variables
  private volumeButtonPresses = 0;
  private volumeButtonTimer: any = null;
  private volumeButtonWindow = 2000; // Time window for triple press (ms)
  
  // Current user settings
  private emergencySettings: EmergencySettings = {
    shakeToAlert: false,
    powerButtonAlert: false,
    audioInstructions: true
  };
  
  constructor(
    private emergencyAlertService: EmergencyAlertService,
    private userService: UserService,
    private authService: AuthService,
    private platform: Platform,
    private ngZone: NgZone
  ) {
    this.initializeDetectors();
  }
  
  /**
   * Initialize emergency detectors when service starts
   */
  private async initializeDetectors() {
    // Wait for platform to be ready
    await this.platform.ready();
    
    // Load user emergency settings
    await this.loadEmergencySettings();
    
    // Setup device event listeners
    this.setupShakeDetection();
    this.setupPowerButtonDetection();
    
    console.log('Emergency detector service initialized');
  }
  
  /**
   * Load current user's emergency settings
   */
  async loadEmergencySettings(): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (currentUser) {
        const userProfile = await this.userService.getUserProfile(currentUser.uid);
        if (userProfile && userProfile.emergencySettings) {
          this.emergencySettings = {
            ...this.emergencySettings,
            ...userProfile.emergencySettings
          };
          
          console.log('Loaded emergency settings:', this.emergencySettings);
          
          // Update detector states based on settings
          this.updateDetectorStates();
        }
      }
    } catch (error) {
      console.error('Error loading emergency settings:', error);
    }
  }
  
  /**
   * Update emergency settings and refresh detectors
   */
  async updateEmergencySettings(newSettings: EmergencySettings): Promise<void> {
    this.emergencySettings = { ...newSettings };
    this.updateDetectorStates();
    console.log('Updated emergency settings:', this.emergencySettings);
  }
  
  /**
   * Enable/disable detectors based on current settings
   */
  private updateDetectorStates(): void {
    this.isShakeDetectionActive = this.emergencySettings.shakeToAlert;
    this.isVolumeButtonDetectionActive = this.emergencySettings.powerButtonAlert;
    
    console.log('Detector states updated:', {
      shake: this.isShakeDetectionActive,
      volumeButton: this.isVolumeButtonDetectionActive
    });
  }
  
  /**
   * Setup shake detection using DeviceMotion API
   */
  private setupShakeDetection(): void {
    if (!window.DeviceMotionEvent) {
      console.warn('DeviceMotion not supported on this device');
      return;
    }
    
    // Request permission for motion sensors (iOS 13+)
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
      // For Android and older iOS
      this.startShakeListening();
    }
  }
  
  /**
   * Start listening for shake gestures
   */
  private startShakeListening(): void {
    window.addEventListener('devicemotion', (event: DeviceMotionEvent) => {
      if (!this.isShakeDetectionActive) return;
      
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;
      
      // Calculate total acceleration magnitude
      const x = acceleration.x || 0;
      const y = acceleration.y || 0;
      const z = acceleration.z || 0;
      const totalAcceleration = Math.sqrt(x * x + y * y + z * z);

      // Only continue if this event represents a strong shake
      if (totalAcceleration <= this.shakeThreshold) {
        return;
      }

      const currentTime = Date.now();

      // Debounce so we count at most one shake every shakeTimeThreshold ms
      if (currentTime - this.lastShakeTime < this.shakeTimeThreshold) {
        return;
      }

      this.lastShakeTime = currentTime;

      // Start or reuse a detection window for multi-shake detection
      if (!this.shakeWindowTimer) {
        this.shakeCount = 0;
        this.shakeWindowTimer = setTimeout(() => {
          this.shakeCount = 0;
          this.shakeWindowTimer = null;
        }, this.shakeDetectionWindow);
      }

      this.shakeCount++;

      // Require three distinct shakes within the detection window
      if (this.shakeCount >= 3) {
        clearTimeout(this.shakeWindowTimer);
        this.shakeWindowTimer = null;
        this.shakeCount = 0;

        // Rate limit actual emergencies from shakes
        const sinceLastEmergency = currentTime - this.lastShakeEmergencyTime;
        if (sinceLastEmergency < this.shakeEmergencyCooldown) {
          console.log('Shake emergency ignored due to cooldown');
          return;
        }

        this.lastShakeEmergencyTime = currentTime;

        this.ngZone.run(() => {
          this.triggerShakeEmergency();
        });
      }
    });
    
    console.log('Shake detection listener activated (requires 3 shakes with cooldown)');
  }
  
  /**
   * Setup volume button detection (triple-press)
   */
  private setupPowerButtonDetection(): void {
    // Listen for hardware volume button events (works on some devices/emulators)
    document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this.isVolumeButtonDetectionActive) return;
      
      // Check for volume button key codes
      if (this.isPowerButtonKey(event)) {
        this.handlePowerButtonPress();
      }
    });
    
    console.log('Volume button detection listener activated');
  }
  
  /**
   * Check if the key event is a volume button press
   */
  private isPowerButtonKey(event: KeyboardEvent): boolean {
    const volumeButtonCodes = [
      'VolumeUp',        // Volume up key
      'VolumeDown',      // Volume down key
      24,                // Android KEYCODE_VOLUME_UP
      25                 // Android KEYCODE_VOLUME_DOWN
    ];
    
    return volumeButtonCodes.includes(event.code) || 
           volumeButtonCodes.includes(event.key) || 
           volumeButtonCodes.includes(event.keyCode);
  }
  
  /**
   * Handle power button press for triple-press detection
   */
  private handlePowerButtonPress(): void {
    this.volumeButtonPresses++;
    
    // Clear existing timer
    if (this.volumeButtonTimer) {
      clearTimeout(this.volumeButtonTimer);
    }
    
    // Check for triple press
    if (this.volumeButtonPresses >= 3) {
      this.ngZone.run(() => {
        this.triggerPowerButtonEmergency();
      });
      this.volumeButtonPresses = 0;
      return;
    }
    
    // Reset counter after time window
    this.volumeButtonTimer = setTimeout(() => {
      this.volumeButtonPresses = 0;
    }, this.volumeButtonWindow);
  }
  
  /**
   * Trigger emergency alert from shake detection
   */
  private async triggerShakeEmergency(): Promise<void> {
    try {
      console.log('Shake emergency detected!');
      await this.emergencyAlertService.triggerEmergencyAlert('shake');
    } catch (error) {
      console.error('Error triggering shake emergency:', error);
    }
  }
  
  /**
   * Trigger emergency alert from power button detection
   */
  private async triggerPowerButtonEmergency(): Promise<void> {
    try {
      console.log('Volume button emergency detected!');
      await this.emergencyAlertService.triggerEmergencyAlert('power-button');
    } catch (error) {
      console.error('Error triggering power button emergency:', error);
    }
  }
  
  /**
   * Test shake detection (for testing purposes)
   */
  async testShakeDetection(): Promise<void> {
    console.log('Testing shake detection...');
    if (this.emergencySettings.shakeToAlert) {
      await this.triggerShakeEmergency();
    } else {
      console.log('Shake detection is disabled');
    }
  }
  
  /**
   * Test power button detection (for testing purposes)
   */
  async testPowerButtonDetection(): Promise<void> {
    console.log('Testing power button detection...');
    if (this.emergencySettings.powerButtonAlert) {
      await this.triggerPowerButtonEmergency();
    } else {
      console.log('Power button detection is disabled');
    }
  }
  
  /**
   * Get current emergency settings
   */
  getEmergencySettings(): EmergencySettings {
    return { ...this.emergencySettings };
  }
  
  /**
   * Check if audio instructions are enabled
   */
  isAudioInstructionsEnabled(): boolean {
    return this.emergencySettings.audioInstructions;
  }
  
  /**
   * Enable/disable shake detection for testing
   */
  setShakeDetectionActive(active: boolean): void {
    this.isShakeDetectionActive = active;
  }
  
  /**
   * Enable/disable power button detection for testing
   */
  setPowerButtonDetectionActive(active: boolean): void {
    this.isVolumeButtonDetectionActive = active;
  }
  
  /**
   * Request device motion permissions (for iOS)
   */
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
    return true; // Permission not needed for this platform
  }
}
