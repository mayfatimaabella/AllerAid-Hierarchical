import { Injectable } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { FirebaseService } from './firebase.service';
import { ProfileDetails } from './models/profile-details.model';

@Injectable({
  providedIn: 'root'
})
export class ProfileDetailService {
  private db = this.firebaseService.getDb();
  private storage = this.firebaseService.getStorage();

  constructor(private firebaseService: FirebaseService) {}

  async getUserProfileDetails(uid: string): Promise<ProfileDetails | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'profile', 'details'));
    return snap.exists() ? snap.data() as ProfileDetails : null;
  }

  async updateProfileDetails(
    uid: string,
    updates: Partial<ProfileDetails>
  ): Promise<void> {
    await setDoc(
      doc(this.db, 'users', uid, 'profile', 'details'),
      updates,
      { merge: true }
    );
  }

  async updateUserProfilePicture(
    uid: string,
    profilePictureUrl: string
  ): Promise<void> {
    await this.updateProfileDetails(uid, {
      profile_picture: profilePictureUrl
    });
  }

  async uploadUserProfilePicture(uid: string, file: File): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const storagePath = `profile_pictures/${uid}/${Date.now()}_${safeName}`;

    const storageRef = ref(this.storage, storagePath);
    const metadata = file.type ? { contentType: file.type } : undefined;

    const snapshot = metadata
      ? await uploadBytes(storageRef, file, metadata)
      : await uploadBytes(storageRef, file);

    const downloadUrl = await getDownloadURL(snapshot.ref);

    await this.updateUserProfilePicture(uid, downloadUrl);

    return downloadUrl;
  }
}