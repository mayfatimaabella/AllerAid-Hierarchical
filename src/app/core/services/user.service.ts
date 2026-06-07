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
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';
import { UserProfile } from './models/user-profile.model';
import { EmergencySettingsService } from './emergency-settings.service';



@Injectable({ providedIn: 'root' })
export class UserService {

    private db = this.firebaseService.getDb();

    private userProfileCache: Map<string, UserProfile> = new Map();

    constructor(
      private firebaseService: FirebaseService,
      private authService: AuthService,
      private emergencySettingsService: EmergencySettingsService
    ) {}


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
        phone: null,
        profile_picture: null,
        dateOfBirth: null,
        bloodType: null,
        gender: null,
      });

      // Medical subcollection
      await setDoc(doc(this.db, 'users', uid, 'medical', 'info'), {
        allergies: [],
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
      await this.emergencySettingsService.initializeDefaults(uid);

      console.log('User profile created successfully');
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }


  // Get just the base profile (for nav, role checks, greetings)
async getUserProfile(uid: string, useCache: boolean = true): Promise<UserProfile | null> {
  try {
    if (useCache && this.userProfileCache.has(uid)) {
      return this.userProfileCache.get(uid)!;
    }

    const userDoc = await getDoc(doc(this.db, 'users', uid));

    if (userDoc.exists()) {
      const profile = userDoc.data() as UserProfile;

      this.userProfileCache.set(uid, profile);
      return profile;
    }

    console.log('No user profile found');
    return null;

  } catch (error) {
    console.error('Error getting user profile:', error);
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

  // Update user profile
    async updateUserProfile(
      uid: string,
      updates: Partial<UserProfile>
    ): Promise<void> {
      try {
        await setDoc(
          doc(this.db, 'users', uid),
          {
            ...updates,
            lastLogin: serverTimestamp()
          },
          { merge: true }
        );

        this.userProfileCache.delete(uid);

        console.log('User profile updated successfully');
      } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
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
        const docSnap = querySnapshot.docs[0];
        const data = docSnap.data() as UserProfile;

        return {
          ...data,
          uid: data.uid || docSnap.id
        } as UserProfile;
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

      return await this.getUserProfile(user.uid);

    } catch (error) {
      console.error('Error ensuring user profile exists:', error);
      return null;
    }
  }

    // Search users by name or email (patients only)
  async searchUsers(searchTerm: string, excludeUserId?: string): Promise<UserProfile[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    try {
      const searchTermLower = searchTerm.toLowerCase().trim();
      const usersRef = collection(this.db, 'users');
      const querySnapshot = await getDocs(usersRef);
      
      const results: UserProfile[] = [];
      
      querySnapshot.docs.forEach(doc => {
        const user = doc.data() as UserProfile;
        const userEmail = (user.email || '').toLowerCase();
        const userFullName = (user.fullName || '').toLowerCase();
        const userFirstName = (user.firstName || '').toLowerCase();
        const userLastName = (user.lastName || '').toLowerCase();
        
        // Exclude the current user if specified
        if (excludeUserId && user.uid === excludeUserId) {
          return;
        }

        // Only include patients (exclude doctors)
        if (user.role === 'doctor' ) {
          return;
        }
        
        // Match by email, full name, first name, or last name
        if (
          userEmail.includes(searchTermLower) ||
          userFullName.includes(searchTermLower) ||
          userFirstName.includes(searchTermLower) ||
          userLastName.includes(searchTermLower)
        ) {
          results.push({
            ...user,
            uid: user.uid || doc.id
          });
        }
      });
      
      return results;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

// Search approved doctors by name or email
async searchApprovedDoctors(
  searchTerm: string,
  excludeUserId?: string
): Promise<UserProfile[]> {

  if (!searchTerm || searchTerm.trim().length < 2) {
    return [];
  }

  try {
    const searchTermLower = searchTerm.toLowerCase().trim();

    const usersRef = collection(this.db, 'users');

    const q = query(
      usersRef,
      where('role', '==', 'doctor'),
      where('verificationStatus', '==', 'approved')
    );

    const querySnapshot = await getDocs(q);

    const results: UserProfile[] = [];

    querySnapshot.docs.forEach(docSnap => {
      const user = docSnap.data() as UserProfile;

      const userEmail = (user.email || '').toLowerCase();
      const userFullName = (user.fullName || '').toLowerCase();
      const userFirstName = (user.firstName || '').toLowerCase();
      const userLastName = (user.lastName || '').toLowerCase();

      // Exclude current user
      if (
        excludeUserId &&
        (user.uid || docSnap.id) === excludeUserId
      ) {
        return;
      }

      if (
        userEmail.includes(searchTermLower) ||
        userFullName.includes(searchTermLower) ||
        userFirstName.includes(searchTermLower) ||
        userLastName.includes(searchTermLower)
      ) {
        results.push({
          ...user,
          uid: user.uid || docSnap.id
        });
      }
    });

    return results;

  } catch (error) {
    console.error('Error searching approved doctors:', error);
    return [];
  }
}

      // Get all doctors for doctor visit selection
  async getDoctors(): Promise<(UserProfile & { specialty?: string })[]> {
    try {
      const usersRef = collection(this.db, 'users');
      const q = query(usersRef, where('role', '==', 'doctor'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        ...(doc.data() as UserProfile),
        specialty: doc.data()['specialty'] || 'General Medicine'
      }));
    } catch (error) {
      console.error('Error getting doctors:', error);
      return [];
    }
  }

    /**
   * Get profile details document
   * users/{uid}/profile/details
   */
  async getUserProfileDetails(uid: string): Promise<any | null> {
    try {
      const snap = await getDoc(
        doc(this.db, 'users', uid, 'profile', 'details')
      );

      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error getting profile details:', error);
      return null;
    }
  }

  /**
   * Get medical info document
   * users/{uid}/medical/info
   */
  async getUserMedicalInfo(uid: string): Promise<any | null> {
    try {
      const snap = await getDoc(
        doc(this.db, 'users', uid, 'medical', 'info')
      );

      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error getting medical info:', error);
      return null;
    }
  }

  /**
   * Get complete emergency profile
   * Combines:
   * users/{uid}
   * users/{uid}/profile/details
   * users/{uid}/medical/info
   */
  async getCompleteEmergencyProfile(uid: string): Promise<any | null> {
    try {
      const [
        baseProfile,
        profileDetails,
        medicalInfo
      ] = await Promise.all([
        this.getUserProfile(uid, false),
        this.getUserProfileDetails(uid),
        this.getUserMedicalInfo(uid)
      ]);

      if (!baseProfile) {
        return null;
      }

      return {
        ...baseProfile,
        profileDetails: profileDetails || {},
        medicalInfo: medicalInfo || {}
      };

    } catch (error) {
      console.error('Error getting complete emergency profile:', error);
      return null;
    }
  }


  // Get doctor credentials (for verification/professional pages)
  async getDoctorCredentials(uid: string): Promise<any | null> {
    const snap = await getDoc(doc(this.db, 'users', uid, 'professional', 'credentials'));
    return snap.exists() ? snap.data() : null;
  }



  // Clear user profile cache (useful for logout or data refresh)
  clearUserProfileCache(uid?: string): void {
    if (uid) {
      this.userProfileCache.delete(uid);
    } else {
      this.userProfileCache.clear();
    }
  }






















}
