import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-emergency-response-notification',
  templateUrl: './emergency-response-notification.component.html',
  styleUrls: ['./emergency-response-notification.component.scss'],
  standalone: false,
})
export class EmergencyResponseNotificationComponent implements OnInit, OnDestroy {
  @Input() responderName: string = 'Your buddy';
  @Input() estimatedTime: string = '';
  @Input() distance: number = 0;
  @Input() estimatedMinutes: number = 0;
  @Output() viewMap = new EventEmitter<any>();
  @Output() dismiss = new EventEmitter<void>();
  
  private audio: HTMLAudioElement | null = null;
  
  constructor(private router: Router) {}
  
  ngOnInit() {
    this.playNotificationSound();
  }
  
  ngOnDestroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }
  
  playNotificationSound() {
    // Play a notification sound when the component is shown
    const soundUrl = 'assets/audio/notification.mp3'; // Replace with your actual sound file
    this.audio = new Audio(soundUrl);
    this.audio.play();
  }
  
  openMap() {
    this.viewMap.emit();
  }
  
  onDismiss() {
    this.dismiss.emit();
  }
}
