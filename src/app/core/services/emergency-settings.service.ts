import { Injectable, OnDestroy } from '@angular/core';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { FirebaseService } from './firebase.service';
import { onAuthStateChanged } from 'firebase/auth';

export interface EmergencySettings {
  shakeToAlert: boolean;
  powerButtonAlert: boolean;
  audioInstructions: boolean;
}

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

@Injectable({ providedIn: 'root' })
export class EmergencySettingsService implements OnDestroy {
  private db;
  private currentUserId: string | null = null;
  private unsubscribe: Unsubscribe | null = null;

  private settingsSubject = new BehaviorSubject<EmergencySettings | null>(null);
  public settings$ = this.settingsSubject.asObservable();

  private readonly DEFAULTS: EmergencySettings = {
    shakeToAlert: false,
    powerButtonAlert: false,
    audioInstructions: false,
  };

  constructor(
    private firebaseService: FirebaseService,
  ) {
    this.db = this.firebaseService.getDb();
    this.initializeAuthListener();
  }

  // ─── Auth listener ────────────────────────────────────────────────────────

private initializeAuthListener(): void {
  onAuthStateChanged(this.firebaseService.getAuth(), user => {
    if (user) {
      this.currentUserId = user.uid;
      this.startListener(user.uid);
    } else {
      this.currentUserId = null;
      this.stopListener();
      this.settingsSubject.next(null);
    }
  });
}

  // ─── Realtime listener ────────────────────────────────────────────────────

  private startListener(uid: string): void {
    this.stopListener();

    const prefsRef = doc(this.db, 'users', uid, 'settings', 'preferences');

    this.unsubscribe = onSnapshot(prefsRef, snap => {
      if (snap.exists()) {
        const emergencySettings = snap.data()?.['emergencySettings'] ?? this.DEFAULTS;
        this.settingsSubject.next(emergencySettings as EmergencySettings);
      } else {
        this.settingsSubject.next(this.DEFAULTS);
      }
    });
  }

  private stopListener(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  // ─── Public read API ──────────────────────────────────────────────────────

  getSettings(): Observable<EmergencySettings | null> {
    return this.settings$;
  }

  /** One-shot read by UID — useful for viewing another user's settings */
  async getEmergencySettings(uid: string): Promise<EmergencySettings | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'settings', 'preferences'));
    return snap.exists()
      ? (snap.data()?.['emergencySettings'] as EmergencySettings) ?? null
      : null;
  }


  async initializeDefaults(uid: string): Promise<void> {
    await setDoc(
      doc(this.db, 'users', uid, 'settings', 'preferences'),
      { emergencySettings: this.DEFAULTS },
      { merge: true }
    );
  }

  async update(patch: Partial<EmergencySettings>): Promise<void> {
    if (!this.currentUserId) throw new Error('User not authenticated');

    await this.updateForUser(this.currentUserId, patch);
  }

  async updateForUser(uid: string, patch: Partial<EmergencySettings>): Promise<void> {
    const currentSettings = this.settingsSubject.value ?? this.DEFAULTS;

    await setDoc(
      doc(this.db, 'users', uid, 'settings', 'preferences'),
      {
        emergencySettings: {
          shakeToAlert: patch.shakeToAlert ?? currentSettings.shakeToAlert,
          powerButtonAlert: patch.powerButtonAlert ?? currentSettings.powerButtonAlert,
          audioInstructions: patch.audioInstructions ?? currentSettings.audioInstructions,
        }
      },
      { merge: true }
    );
  }

  async setShakeToAlert(enabled: boolean): Promise<void> {
    await this.update({ shakeToAlert: enabled });
  }

  async setPowerButtonAlert(enabled: boolean): Promise<void> {
    await this.update({ powerButtonAlert: enabled });
  }

  async setAudioInstructions(enabled: boolean): Promise<void> {
    await this.update({ audioInstructions: enabled });
  }

  async resetToDefaults(): Promise<void> {
    await this.update(this.DEFAULTS);
  }

  // ─── Emergency location ───────────────────────────────────────────────────

  /**
   * Write live location to users/{uid}/emergency/active.
   * Kept separate from medical/info — this doc is isolated for frequent writes.
   */
  async updateEmergencyLocation(uid: string, location: EmergencyLocation): Promise<void> {
    await setDoc(
      doc(this.db, 'users', uid, 'emergency', 'active'),
      { location, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }


  ngOnDestroy(): void {
    this.stopListener();
  }
}