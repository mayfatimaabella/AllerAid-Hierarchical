import { Injectable } from '@angular/core';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: string;
  avatar?: string;
  phone?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dateOfBirth?: string;
  bloodType?: string;
  
  // Healthcare professional fields
  license?: string; // Medical license number
  specialty?: string; // Medical specialty
  hospital?: string; // Hospital or practice name
  licenseURL?: string; // License photo download URL
  emergencyInstruction?: string;
  emergencyMessage?: {
    name: string;
    allergies: string;
    instructions: string;
    location: string;
    audioUrl?: string; // Optional audio instruction URL
  };
  emergencySettings?: {
    shakeToAlert: boolean;
    powerButtonAlert: boolean;
    audioInstructions: boolean;
  };
  emergencyLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: any;
  };
  dateCreated?: any;
  lastLogin?: any;
  isActive: boolean;
  allergyOnboardingCompleted?: boolean;
  onboarding?: {
    profileCompleted: boolean;
    allergyCompleted?: boolean;
    emergencySetupCompleted?: boolean;
    licenseSubmitted?: boolean;
    licenseVerified?: boolean;
  };
}

export interface ProfileDetails {
  phone: string | null;
  avatar: string | null;
  dateOfBirth: string | null;
  bloodType: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

export interface MedicalInfo {
  allergies: any[];
  emergencyMessage: UserProfile['emergencyMessage'] | null;
  allergyOnboardingCompleted: boolean;
}

export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  address: string;
  timestamp?: any;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  // Create user profile for registration
  async createUserProfile(
    uid: string,
    userData: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      licenseURL?: string;
      license?: string;
      specialty?: string;
      hospital?: string;
      phone?: string;
    }
  ): Promise<void> {
    try {
      const baseProfile = {
        uid,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        fullName: `${userData.firstName} ${userData.lastName}`.trim(),
        role: userData.role,
        dateCreated: serverTimestamp(),
        isActive: true
      };

      // Base user doc
      await setDoc(doc(this.db, 'users', uid), baseProfile);

      // Profile subcollection
      await setDoc(doc(this.db, 'users', uid, 'profile', 'details'), {
        phone: userData.phone ?? null,
        avatar: null,
        dateOfBirth: null,
        bloodType: null,
        emergencyContactName: null,
        emergencyContactPhone: null
      });

      // Medical subcollection
      await setDoc(doc(this.db, 'users', uid, 'medical', 'info'), {
        allergies: [],
        emergencyMessage: null,
        allergyOnboardingCompleted: false
      });

      // Doctor-only professional subcollection
      if (userData.role === 'doctor') {
        await setDoc(doc(this.db, 'users', uid, 'professional', 'credentials'), {
          license: userData.license ?? null,
          specialty: userData.specialty ?? null,
          hospital: userData.hospital ?? null,
          licenseURL: userData.licenseURL ?? null,
          verificationStatus: 'pending'
        });
      }

      // Settings subcollection
      await setDoc(doc(this.db, 'users', uid, 'settings', 'preferences'), {
        emergencySettings: {
          shakeToAlert: false,
          powerButtonAlert: false,
          audioInstructions: false
        }
      });

      console.log('User profile created successfully');
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }
  private db: any;
  private storage: any;
  private userProfileCache: Map<string, UserProfile> = new Map();
  constructor(private firebaseService: FirebaseService, private authService: AuthService) {
    this.db = this.firebaseService.getDb();
    this.storage = this.firebaseService.getStorage();
  }

  // Get just the base profile (for nav, role checks, greetings)
  async getUserProfile(uid: string, useCache: boolean = true): Promise<UserProfile | null> {
    try {
      // Check cache first if enabled
      if (useCache && this.userProfileCache.has(uid)) {
        return this.userProfileCache.get(uid)!;
      }

      const userDoc = await getDoc(doc(this.db, 'users', uid));
      
      if (userDoc.exists()) {
        const profile = userDoc.data() as UserProfile;

        // Cache the profile
        this.userProfileCache.set(uid, profile);
        return profile;
      } else {
        console.log('No user profile found');
        return null;
      }
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Get profile details (for profile page)
  async getUserProfileDetails(uid: string): Promise<any | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'profile', 'details'));
    return snap.exists() ? snap.data() : null;
  }

  // Get medical info (for emergency/allergy pages)
  async getUserMedicalInfo(uid: string): Promise<any | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'medical', 'info'));
    return snap.exists() ? snap.data() : null;
  }

  // Get doctor credentials (for verification/professional pages)
  async getDoctorCredentials(uid: string): Promise<any | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'professional', 'credentials'));
    return snap.exists() ? snap.data() : null;
  }

  // Get emergency settings only
  async getEmergencySettings(uid: string): Promise<UserProfile['emergencySettings'] | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'settings', 'preferences'));
    return snap.exists() ? (snap.data()?.['emergencySettings'] ?? null) : null;
  }

  // Update only profile details; does not touch base or medical docs.
  async updateProfileDetails(uid: string, updates: Partial<ProfileDetails>): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid, 'profile', 'details'), updates);
    this.userProfileCache.delete(uid);
  }

  // Update only medical info.
  async updateMedicalInfo(uid: string, updates: Partial<MedicalInfo>): Promise<void> {
    await updateDoc(doc(this.db, 'users', uid, 'medical', 'info'), updates);
  }

  // Update emergency location in a dedicated doc used for frequent writes.
  async updateEmergencyLocation(uid: string, location: EmergencyLocation): Promise<void> {
    await setDoc(
      doc(this.db, 'users', uid, 'emergency', 'active'),
      { location, updatedAt: serverTimestamp() },
      { merge: true }
    );
  }

  // Update user profile
  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const baseUpdates: any = {};
      const profileUpdates: any = {};
      const professionalUpdates: any = {};
      const medicalUpdates: any = {};
      const settingsUpdates: any = {};

      const baseFields = ['email', 'firstName', 'lastName', 'fullName', 'role', 'isActive'];
      const profileFields = ['phone', 'avatar', 'dateOfBirth', 'bloodType', 'emergencyContactName', 'emergencyContactPhone'];
      const professionalFields = ['license', 'specialty', 'hospital', 'licenseURL'];

      for (const [key, value] of Object.entries(updates)) {
        if (baseFields.includes(key)) {
          baseUpdates[key] = value;
          continue;
        }

        if (profileFields.includes(key)) {
          profileUpdates[key] = value;
          continue;
        }

        if (professionalFields.includes(key)) {
          professionalUpdates[key] = value;
          continue;
        }

        if (key === 'emergencyMessage') {
          medicalUpdates.emergencyMessage = value;
          continue;
        }

        if (key === 'allergyOnboardingCompleted') {
          medicalUpdates.allergyOnboardingCompleted = value;
          continue;
        }

        if (key === 'emergencySettings') {
          settingsUpdates.emergencySettings = value;
        }
      }

      baseUpdates.lastLogin = serverTimestamp();

      await setDoc(doc(this.db, 'users', uid), baseUpdates, { merge: true });
      if (Object.keys(profileUpdates).length > 0) {
        await setDoc(doc(this.db, 'users', uid, 'profile', 'details'), profileUpdates, { merge: true });
      }
      if (Object.keys(professionalUpdates).length > 0) {
        await setDoc(doc(this.db, 'users', uid, 'professional', 'credentials'), professionalUpdates, { merge: true });
      }
      if (Object.keys(medicalUpdates).length > 0) {
        await setDoc(doc(this.db, 'users', uid, 'medical', 'info'), medicalUpdates, { merge: true });
      }
      if (Object.keys(settingsUpdates).length > 0) {
        await setDoc(doc(this.db, 'users', uid, 'settings', 'preferences'), settingsUpdates, { merge: true });
      }
      
      // Clear cache to ensure fresh data on next request
      this.userProfileCache.delete(uid);
      
      console.log('User profile updated successfully');
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  // Clear user profile cache (useful for logout or data refresh)
  clearUserProfileCache(uid?: string): void {
    if (uid) {
      this.userProfileCache.delete(uid);
    } else {
      this.userProfileCache.clear();
    }
  }

  // Update last login timestamp
  async updateLastLogin(uid: string): Promise<void> {
    try {
      // First check if user document exists
      const userDoc = await getDoc(doc(this.db, 'users', uid));
      
      if (userDoc.exists()) {
        await updateDoc(doc(this.db, 'users', uid), {
          lastLogin: serverTimestamp()
        });
        console.log('Last login updated successfully');
      } else {
        console.log('User document does not exist, cannot update last login');
      }
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  // Get current user profile
  async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      const user = this.authService.getCurrentUser();
      if (user) {
        return await this.getUserProfile(user.uid);
      }
      return null;
    } catch (error) {
      console.error('Error getting current user profile:', error);
      throw error;
    }
  }

  // Delete user profile
  async deleteUserProfile(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, 'users', uid));
      console.log('User profile deleted successfully');
    } catch (error) {
      console.error('Error deleting user profile:', error);
      throw error;
    }
  }

  // Check if user profile exists
  async userProfileExists(uid: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(this.db, 'users', uid));
      return userDoc.exists();
    } catch (error) {
      console.error('Error checking user profile existence:', error);
      return false;
    }
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  }

  // Utility method to check and create profile for current user if needed
  async ensureUserProfileExists(): Promise<UserProfile | null> {
    try {
      const user = this.authService.getCurrentUser();
      if (!user) {
        return null;
      }

      let userProfile = await this.getUserProfile(user.uid);
      
      if (!userProfile && user.email) {
        // Create profile for existing auth user
        await this.createUserProfileFromAuth(user.uid, user.email);
        userProfile = await this.getUserProfile(user.uid);
      }

      return userProfile;
    } catch (error) {
      console.error('Error ensuring user profile exists:', error);
      return null;
    }
  }

  // Create buddy user profile (simplified registration)
  async createBuddyProfile(
    uid: string, 
    email: string, 
    firstName: string, 
    lastName: string,
    phone: string
  ): Promise<void> {
    try {
      await this.createUserProfile(uid, {
        email,
        firstName,
        lastName,
        role: 'buddy',
        phone
      });
      console.log('Buddy profile created successfully');
    } catch (error) {
      console.error('Error creating buddy profile:', error);
      throw error;
    }
  }

  // Create user profile for existing auth users (migration helper)
  async createUserProfileFromAuth(uid: string, email: string): Promise<void> {
    try {
      // Check if profile already exists
      const existingProfile = await this.getUserProfile(uid);
      if (existingProfile) {
        console.log('User profile already exists');
        return;
      }

      // Extract names from email
      const emailParts = email.split('@')[0];
      const firstName = emailParts.split('.')[0] || 'User';
      const lastName = emailParts.split('.')[1] || '';

      const userProfile: UserProfile = {
        uid,
        email: email,
        firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
        lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1),
        fullName: `${firstName.charAt(0).toUpperCase() + firstName.slice(1)} ${lastName.charAt(0).toUpperCase() + lastName.slice(1)}`.trim(),
        role: 'user',
        isActive: true
      };

      await this.createUserProfile(uid, {
        email: userProfile.email,
        firstName: userProfile.firstName,
        lastName: userProfile.lastName,
        role: userProfile.role
      });
      console.log('User profile created from existing auth user');
    } catch (error) {
      console.error('Error creating user profile from auth:', error);
      throw error;
    }
  }

  // Check if user has completed allergy onboarding
  async hasCompletedAllergyOnboarding(uid: string): Promise<boolean> {
    try {
      // This onboarding check only applies to patients.
      const userProfile = await this.getUserProfile(uid);
      if (userProfile?.role && userProfile.role !== 'user') {
        return true;
      }

      const medicalInfo = await this.getUserMedicalInfo(uid);
      if (medicalInfo?.allergyOnboardingCompleted) {
        return true;
      }
      
  // Fallback: check if user has any allergies saved
  // TODO: Implement getUserAllergies or remove this check
  // const userAllergies = await this.getUserAllergies(uid);
  // return userAllergies.length > 0;
  return false;
    } catch (error) {
      console.error('Error checking allergy onboarding status:', error);
      return false;
    }
  }

  // Mark allergy onboarding as completed
  async markAllergyOnboardingCompleted(uid: string): Promise<void> {
    try {
      await setDoc(doc(this.db, 'users', uid, 'medical', 'info'), {
        allergyOnboardingCompleted: true
      }, { merge: true });
      console.log('Allergy onboarding marked as completed');
    } catch (error) {
      console.error('Error marking allergy onboarding as completed:', error);
      throw error;
    }
  }


  // Update user avatar
  async updateUserAvatar(uid: string, avatarUrl: string): Promise<void> {
    try {
      await setDoc(doc(this.db, 'users', uid, 'profile', 'details'), {
        avatar: avatarUrl
      }, { merge: true });
      console.log('User avatar updated successfully');
    } catch (error) {
      console.error('Error updating user avatar:', error);
      throw error;
    }
  }

  // Upload user avatar to storage and update profile
  async uploadUserAvatar(uid: string, file: File): Promise<string> {
    try {
      console.log('UserService: Starting upload', { uid, fileName: file.name, size: file.size });
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
      const storagePath = `avatars/${uid}/${Date.now()}_${safeName}`;
      console.log('UserService: Storage path:', storagePath);
      
      const storageRef = ref(this.storage, storagePath);
      const metadata = file.type ? { contentType: file.type } : undefined;

      console.log('UserService: Uploading bytes...');
      const snapshot = metadata
        ? await uploadBytes(storageRef, file, metadata)
        : await uploadBytes(storageRef, file);
      console.log('UserService: Upload complete, getting URL...');

      const downloadUrl = await getDownloadURL(snapshot.ref);
      console.log('UserService: Download URL obtained:', downloadUrl);
      
      await this.updateUserAvatar(uid, downloadUrl);
      console.log('UserService: Profile updated successfully');
      return downloadUrl;
    } catch (error) {
      console.error('UserService: Upload failed:', error);
      console.error('Error uploading user avatar:', error);
      throw error;
    }
  }

  // Get all doctors and nurses for doctor visit selection
  async getDoctorsAndNurses(): Promise<(UserProfile & { specialty?: string })[]> {
    try {
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, where('role', 'in', ['doctor', 'nurse']));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        ...(doc.data() as UserProfile),
        specialty: doc.data()['specialty'] || 'General Medicine'
      }));
    } catch (error) {
      console.error('Error getting doctors and nurses:', error);
      return [];
    }
  }
}

