import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

export interface BuddyResponseData {
  buddyName: string;
  estimatedArrival: string;
  distance: string;
  routePreview?: string;
}

@Component({
  selector: 'app-buddy-response-alert',
  templateUrl: './buddy-response-alert.component.html',
  styleUrls: ['./buddy-response-alert.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class BuddyResponseAlertComponent implements OnInit, OnDestroy {
  @Input() buddyData!: BuddyResponseData;
  
  private audio: HTMLAudioElement | null = null;
  private vibrationPattern = [500, 300, 500, 300, 500]; // Pattern for vibration

  constructor(private modalController: ModalController) {}

  ngOnInit() {
    this.playAlertSound();
    this.triggerVibration();
  }

  ngOnDestroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  private playAlertSound() {
    try {
      // Create a simple beep sound for accessibility
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // High frequency beep
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);
      
      // Alternative: use a predefined audio file if available
      // this.audio = new Audio('assets/sounds/buddy-alert.mp3');
      // this.audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (error) {
      console.log('Audio alert failed:', error);
    }
  }

  private triggerVibration() {
    if ('vibrate' in navigator) {
      navigator.vibrate(this.vibrationPattern);
    }
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  async showRoute() {
    await this.modalController.dismiss('show-route');
  }
}