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
  volumeButtonAlert: boolean;
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
    volumeButtonAlert: false,
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
        const raw = snap.data()?.['emergencySettings'];
        this.settingsSubject.next(this.normalize(raw));
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

  /**
   * Normalizes raw Firestore data into the current EmergencySettings shape.
   * Falls back to the legacy `powerButtonAlert` field name for documents
   * that were written before the field was renamed to `volumeButtonAlert`,
   * so existing users don't silently lose their saved preference.
   */
  private normalize(raw: any): EmergencySettings {
    if (!raw) return this.DEFAULTS;

    return {
      shakeToAlert: raw.shakeToAlert ?? this.DEFAULTS.shakeToAlert,
      volumeButtonAlert:
        raw.volumeButtonAlert ?? raw.powerButtonAlert ?? this.DEFAULTS.volumeButtonAlert,
      audioInstructions: raw.audioInstructions ?? this.DEFAULTS.audioInstructions,
    };
  }

  // ─── Public read API ──────────────────────────────────────────────────────

  getSettings(): Observable<EmergencySettings | null> {
    return this.settings$;
  }

  /** One-shot read by UID — useful for viewing another user's settings */
  async getEmergencySettings(uid: string): Promise<EmergencySettings | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'settings', 'preferences'));
    return snap.exists()
      ? this.normalize(snap.data()?.['emergencySettings'])
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
          volumeButtonAlert: patch.volumeButtonAlert ?? currentSettings.volumeButtonAlert,
          audioInstructions: patch.audioInstructions ?? currentSettings.audioInstructions,
        }
      },
      { merge: true }
    );
  }

  async setShakeToAlert(enabled: boolean): Promise<void> {
    await this.update({ shakeToAlert: enabled });
  }

  async setVolumeButtonAlert(enabled: boolean): Promise<void> {
    await this.update({ volumeButtonAlert: enabled });
  }

  /**
   * @deprecated Renamed to setVolumeButtonAlert. Kept temporarily as an alias
   * so any other call sites still using the old name don't break — remove
   * once those call sites are updated.
   */
  async setPowerButtonAlert(enabled: boolean): Promise<void> {
    await this.setVolumeButtonAlert(enabled);
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