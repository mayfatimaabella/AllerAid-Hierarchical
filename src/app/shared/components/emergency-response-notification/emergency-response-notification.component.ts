import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';

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
    const soundUrl = 'assets/audio/notification.mp3';
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
