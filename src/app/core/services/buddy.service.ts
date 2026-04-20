import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebase.config';
import { environment } from '../../../environments/environment';
import { UserService } from './user.service';

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  getDoc,
  setDoc,
  limit
} from 'firebase/firestore';
import { BehaviorSubject} from 'rxjs';

export interface Buddy {
  id?: string;
  userId: string; // User who added this buddy
  firstName: string;
  lastName: string;
  relationship: string;
  contactNumber: string;
  email?: string;

}

export interface BuddyInvitation {
  id?: string;
  fromUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  toUserId: string;
  toUserEmail: string;
  toUserName: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: Date;
  respondedAt?: Date;
}

export interface BuddyRelation {
  id?: string;
  user1Id: string;
  user2Id: string;
  status: 'pending' | 'accepted';
  invitationId: string;
  createdAt: Date;
  acceptedAt?: Date;
  deletedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class BuddyService {
  private db;
  
  // Maximum number of buddy relations allowed per user
  private readonly MAX_BUDDY_RELATIONS = 10;
  
  // Observable for active emergency alerts for the current user's buddies
  private activeEmergencyAlertsSubject = new BehaviorSubject<any[]>([]);
  activeEmergencyAlerts$ = this.activeEmergencyAlertsSubject.asObservable();

  // Observable for pending buddy invitations
  private pendingInvitationsSubject = new BehaviorSubject<BuddyInvitation[]>([]);
  pendingInvitations$ = this.pendingInvitationsSubject.asObservable();

  // Observable for buddy relations (accepted buddy connections)
  private buddyRelationsSubject = new BehaviorSubject<any[]>([]);
  buddyRelations$ = this.buddyRelationsSubject.asObservable();

  // Guards to prevent duplicate listener setup
  private activeListeners = new Set<string>();
  private relationListeners = new Set<string>();
  private invitationListeners = new Set<string>();

  constructor(private userService: UserService) {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
  }

  // Store a dismissal for a specific user so future pop-ups are suppressed
  dismissEmergencyForUser(userId: string, emergencyId: string): void {
    try {
      const key = `dismissedEmergencies_${userId}`;
      const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');
      if (!list.includes(emergencyId)) {
        list.push(emergencyId);
        localStorage.setItem(key, JSON.stringify(list));
      }

      // Also immediately update the active emergencies stream so badges/UI reflect the dismissal
      const current = this.activeEmergencyAlertsSubject.value;
      const updated = current.filter(e => e.id !== emergencyId);
      this.activeEmergencyAlertsSubject.next(updated);
    } catch (e) {
      console.warn('Failed to persist emergency dismissal', e);
    }
  }

  // Persist dismissed alert snapshot data for local history (per user)
  saveDismissedAlertData(userId: string, alert: any): void {
    try {
      const key = `dismissedAlerts_${userId}`;
      const current: any[] = JSON.parse(localStorage.getItem(key) || '[]');
      const minimal = {
        id: alert.id,
        status: alert.status,
        createdAt: alert.createdAt || alert.timestamp || new Date().toISOString(),
        location: alert.location || null,
        patientId: alert.patientId || null,
        // Prefer explicit patientName, then userName so history can show a label
        patientName: alert.patientName || alert.userName || 'Unknown',
        responderId: alert.responderId || null,
        responderName: alert.responderName || null,
        dismissedAt: new Date().toISOString()
      };
      // De-duplicate by id
      const exists = current.find(a => a.id === minimal.id);
      const updated = exists ? current.map(a => a.id === minimal.id ? minimal : a) : [...current, minimal];
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist dismissed alert data', e);
    }
  }

  // CREATE buddy
  async addBuddy(buddy: any): Promise<string> {
    const docRef = await addDoc(collection(this.db, 'buddies'), buddy);
    return docRef.id;
  }

  // READ all buddies
  async getBuddies(): Promise<any[]> {
    const querySnapshot = await getDocs(collection(this.db, 'buddies'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // UPDATE buddy
  async updateBuddy(id: string, updatedData: any): Promise<void> {
    try {
      const buddyDoc = doc(this.db, 'buddies', id);
      const snap = await getDoc(buddyDoc);

      if (snap.exists()) {
        await updateDoc(buddyDoc, updatedData);
      } else {
        // If the document doesn't exist, create it (fallback)
        await setDoc(buddyDoc, { id, ...updatedData });
        if (!environment.production) {
          console.warn(`Buddy doc ${id} did not exist. Created new document.`);
        }
      }
    } catch (error) {
      console.error('Error updating buddy:', error);
      throw error;
    }
  }

  // DELETE buddy
  async deleteBuddy(buddyToDelete: any): Promise<void> {
    try {
      // Check if this buddy comes from buddy_relations
      if (buddyToDelete.isFromRelation) {
        // Get current user ID
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const currentUserId = currentUser.uid;
        const connectedUserId = buddyToDelete.connectedUserId;

        // Delete the relation in BOTH directions to ensure complete removal
        // Direction 1: Where current user is user1 and connected user is user2
        const q1 = query(
          collection(this.db, 'buddy_relations'),
          where('user1Id', '==', currentUserId),
          where('user2Id', '==', connectedUserId)
        );
        
        // Direction 2: Where connected user is user1 and current user is user2
        const q2 = query(
          collection(this.db, 'buddy_relations'),
          where('user1Id', '==', connectedUserId),
          where('user2Id', '==', currentUserId)
        );

        const [snapshot1, snapshot2] = await Promise.all([
          getDocs(q1),
          getDocs(q2)
        ]);

        // Delete both directions
        if (!snapshot1.empty) {
          await deleteDoc(doc(this.db, 'buddy_relations', snapshot1.docs[0].id));
          if (!environment.production) {
            console.log('Deleted buddy relation (direction 1):', snapshot1.docs[0].id);
          }
        }

        if (!snapshot2.empty) {
          await deleteDoc(doc(this.db, 'buddy_relations', snapshot2.docs[0].id));
          if (!environment.production) {
            console.log('Deleted buddy relation (direction 2):', snapshot2.docs[0].id);
          }
        }
      } else {
        // Delete from legacy buddies collection
        const buddyDoc = doc(this.db, 'buddies', buddyToDelete.id);
        await deleteDoc(buddyDoc);
        
        if (!environment.production) {
          console.log('Deleted legacy buddy:', buddyToDelete.id);
        }
      }
    } catch (error) {
      console.error('Error deleting buddy:', error);
      throw error;
    }
  }

  // READ buddies for specific user
  async getUserBuddies(userId: string): Promise<any[]> {
    try {
      if (!environment.production) {
        console.log('Fetching buddy relationships for userId:', userId);
      }
      
      // Get buddy relations where this user is either user1 (patient) or user2 (buddy)
      const relations = await this.getBuddyRelationsForUser(userId);
      
      // Convert relations to buddy objects with proper user info
      const buddies = [];
      
      for (const relation of relations) {
        // Determine if this user is the patient or the buddy
        const isPatient = relation.user1Id === userId;
        const otherUserId = isPatient ? relation.user2Id : relation.user1Id;
        
        try {
          // Fetch the actual user profile data for the connected user
          const userProfile = await this.userService.getUserProfile(otherUserId);
          
          if (userProfile) {
            // Create buddy object with actual user profile data
            const buddy = {
              id: relation.id,
              userId: userId, // Keep the current user's ID for compatibility
              relationId: relation.id,
              connectedUserId: otherUserId,
              firstName: userProfile.firstName || 'Unknown',
              lastName: userProfile.lastName || 'User',
              relationship: isPatient ? 'Emergency Buddy' : 'Protected Patient',
              contactNumber: userProfile.phone || '',
              email: userProfile.email || '',
              status: relation.status,
              acceptedAt: relation.acceptedAt,
              isFromRelation: true // Flag to indicate this comes from buddy_relations
            };
            
            buddies.push(buddy);
          } else {
            // Fallback if user profile not found
            if (!environment.production) {
              console.warn('User profile not found for userId:', otherUserId);
            }
            
            const buddy = {
              id: relation.id,
              userId: userId,
              relationId: relation.id,
              connectedUserId: otherUserId,
              firstName: 'Unknown',
              lastName: 'User',
              relationship: isPatient ? 'Emergency Buddy' : 'Protected Patient',
              contactNumber: '',
              email: '',
              status: relation.status,
              acceptedAt: relation.acceptedAt,
              isFromRelation: true
            };
            
            buddies.push(buddy);
          }
        } catch (profileError) {
          if (!environment.production) {
            console.error('Error fetching profile for user:', otherUserId, profileError);
          }
          
          // Fallback buddy object if profile fetch fails
          const buddy = {
            id: relation.id,
            userId: userId,
            relationId: relation.id,
            connectedUserId: otherUserId,
            firstName: 'Profile',
            lastName: 'Error',
            relationship: isPatient ? 'Emergency Buddy' : 'Protected Patient',
            contactNumber: '',
            email: '',
            status: relation.status,
            acceptedAt: relation.acceptedAt,
            isFromRelation: true
          };
          
          buddies.push(buddy);
        }
      }

      if (!environment.production) {
        console.log('Found buddy relationships with profiles:', buddies.length);
        console.log('Buddy details:', buddies);
      }
      return buddies;
    } catch (error) {
      console.error('Error fetching user buddies:', error);
      return [];
    }
  }

  // Get buddy relations for a specific user
  async getBuddyRelationsForUser(userId: string): Promise<any[]> {
    try {
      // Query where user is user1 (patient)
      const q1 = query(
        collection(this.db, 'buddy_relations'),
        where('user1Id', '==', userId),
        where('status', '==', 'accepted')
      );
      
      // Query where user is user2 (buddy)
      const q2 = query(
        collection(this.db, 'buddy_relations'),
        where('user2Id', '==', userId),
        where('status', '==', 'accepted')
      );
      
      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      const relations: any[] = [];
      
      snapshot1.docs.forEach(doc => {
        relations.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data()['createdAt']?.toDate(),
          acceptedAt: doc.data()['acceptedAt']?.toDate()
        });
      });
      
      snapshot2.docs.forEach(doc => {
        relations.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data()['createdAt']?.toDate(),
          acceptedAt: doc.data()['acceptedAt']?.toDate()
        });
      });
      
      if (!environment.production) {
        console.log('Found relations for user:', relations.length);
      }
      return relations;
    } catch (error) {
      console.error('Error getting buddy relations:', error);
      return [];
    }
  }

  // Helper method to debug all buddies (for troubleshooting)
  async debugAllBuddies(): Promise<void> {
    try {
      const querySnapshot = await getDocs(collection(this.db, 'buddies'));
      const allBuddies = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      console.log('DEBUG - All buddies in database:', allBuddies);
    } catch (error) {
      console.error('Error debugging buddies:', error);
    }
  }
  
  // Get a specific buddy by ID
  async getBuddyById(buddyId: string): Promise<Buddy | null> {
    try {
      const buddyDoc = doc(this.db, 'buddies', buddyId);
      const buddySnap = await getDoc(buddyDoc);
      
      if (buddySnap.exists()) {
        return { id: buddySnap.id, ...buddySnap.data() } as Buddy;
      }
      return null;
    } catch (error) {
      console.error('Error getting buddy by ID:', error);
      return null;
    }
  }
  
  // Check if the current buddy ID is in any active emergencies
  listenForEmergencyAlerts(buddyId: string): void {
    // Prevent duplicate listeners for the same buddy
    if (this.activeListeners.has(buddyId)) {
      if (!environment.production) {
        console.log('Emergency alert listener already exists for buddy:', buddyId);
      }
      return;
    }
    
    // Mark this buddy as having an active listener
    this.activeListeners.add(buddyId);
    
    const emergenciesRef = collection(this.db, 'emergencies');
    
    // Query for active emergencies that include this buddy ID
    const q = query(
      emergenciesRef,
      where('buddyIds', 'array-contains', buddyId),
      where('status', 'in', ['active', 'responding'])
    );
    
    // Set up real-time listener
    onSnapshot(q, (querySnapshot) => {
      const emergencies: any[] = [];
      // Load dismissed emergency IDs for this user from localStorage
      const dismissedKey = `dismissedEmergencies_${buddyId}`;
      const dismissedList: string[] = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
      const dismissedSet = new Set(dismissedList);

      querySnapshot.forEach((doc) => {
        const emergency = { id: doc.id, ...doc.data() };
        // Filter out locally dismissed emergencies for this user
        if (!dismissedSet.has(emergency.id)) {
          emergencies.push(emergency);
        }
      });
      this.activeEmergencyAlertsSubject.next(emergencies);
    });
  }
  
  // Respond to an emergency alert (for buddies)
  async respondToEmergency(emergencyId: string, buddyId: string, buddyName: string): Promise<void> {
    try {
      const emergencyRef = doc(this.db, 'emergencies', emergencyId);
      
      // Update the emergency status
      await updateDoc(emergencyRef, {
        status: 'responding',
        responderId: buddyId,
        responderName: buddyName
      });
    } catch (error) {
      console.error('Error responding to emergency:', error);
      throw error;
    }
  }

  // Check if buddy relationship already exists by email
  async checkDuplicateBuddyByEmail(currentUserId: string, targetEmail: string): Promise<{ isDuplicate: boolean; type: string; details?: any }> {
    try {
      const targetEmailLower = targetEmail.toLowerCase().trim();
      
      // Check existing buddy relations (two-way relationships)
      const relationsQuery = query(
        collection(this.db, 'buddy_relations'),
        where('user1Id', '==', currentUserId)
      );
      const relationsSnapshot = await getDocs(relationsQuery);
      
      for (const relationDoc of relationsSnapshot.docs) {
        const relation = relationDoc.data();
        // Get the other user's profile to check email
        const otherUserId = relation['user2Id'];
        const otherUserProfile = await this.userService.getUserProfile(otherUserId);
        if (otherUserProfile && otherUserProfile.email?.toLowerCase() === targetEmailLower) {
          return {
            isDuplicate: true,
            type: 'existing_buddy',
            details: { name: `${otherUserProfile.firstName} ${otherUserProfile.lastName}` }
          };
        }
      }

      // Check the reverse direction
      const reverseRelationsQuery = query(
        collection(this.db, 'buddy_relations'),
        where('user2Id', '==', currentUserId)
      );
      const reverseRelationsSnapshot = await getDocs(reverseRelationsQuery);
      
      for (const relationDoc of reverseRelationsSnapshot.docs) {
        const relation = relationDoc.data();
        const otherUserId = relation['user1Id'];
        const otherUserProfile = await this.userService.getUserProfile(otherUserId);
        if (otherUserProfile && otherUserProfile.email?.toLowerCase() === targetEmailLower) {
          return {
            isDuplicate: true,
            type: 'existing_buddy',
            details: { name: `${otherUserProfile.firstName} ${otherUserProfile.lastName}` }
          };
        }
      }

      // Check pending invitations sent by current user
      const sentInvitationsQuery = query(
        collection(this.db, 'buddy_invitations'),
        where('fromUserId', '==', currentUserId),
        where('toUserEmail', '==', targetEmailLower),
        where('status', '==', 'pending')
      );
      const sentInvitationsSnapshot = await getDocs(sentInvitationsQuery);
      
      if (!sentInvitationsSnapshot.empty) {
        const invitation = sentInvitationsSnapshot.docs[0].data();
        return {
          isDuplicate: true,
          type: 'pending_sent_invitation',
          details: { name: invitation['toUserName'] }
        };
      }

      // Check pending invitations received by current user
      const receivedInvitationsQuery = query(
        collection(this.db, 'buddy_invitations'),
        where('toUserId', '==', currentUserId),
        where('fromUserEmail', '==', targetEmailLower),
        where('status', '==', 'pending')
      );
      const receivedInvitationsSnapshot = await getDocs(receivedInvitationsQuery);
      
      if (!receivedInvitationsSnapshot.empty) {
        const invitation = receivedInvitationsSnapshot.docs[0].data();
        return {
          isDuplicate: true,
          type: 'pending_received_invitation',
          details: { name: invitation['fromUserName'] }
        };
      }

      // Check legacy buddies collection
      const legacyBuddiesQuery = query(
        collection(this.db, 'buddies'),
        where('userId', '==', currentUserId),
        where('email', '==', targetEmailLower)
      );
      const legacyBuddiesSnapshot = await getDocs(legacyBuddiesQuery);
      
      if (!legacyBuddiesSnapshot.empty) {
        const buddy = legacyBuddiesSnapshot.docs[0].data();
        return {
          isDuplicate: true,
          type: 'legacy_buddy',
          details: { name: `${buddy['firstName']} ${buddy['lastName']}` }
        };
      }

      return { isDuplicate: false, type: 'none' };
      
    } catch (error) {
      console.error('Error checking duplicate buddy:', error);
      throw error;
    }
  }

  // Count the current accepted buddy relations for a user
  async countUserBuddyRelations(userId: string): Promise<number> {
    try {
      // Query where user is user1 (patient)
      const q1 = query(
        collection(this.db, 'buddy_relations'),
        where('user1Id', '==', userId),
        where('status', '==', 'accepted')
      );
      
      // Query where user is user2 (buddy)
      const q2 = query(
        collection(this.db, 'buddy_relations'),
        where('user2Id', '==', userId),
        where('status', '==', 'accepted')
      );
      
      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      const totalBuddies = snapshot1.docs.length + snapshot2.docs.length;
      
      if (!environment.production) {
        console.log(`User ${userId} has ${totalBuddies} buddy relations`);
      }
      
      return totalBuddies;
    } catch (error) {
      console.error('Error counting buddy relations:', error);
      return 0;
    }
  }

  // Check if user has reached the maximum buddy relation limit
  async hasReachedBuddyLimit(userId: string): Promise<boolean> {
    const count = await this.countUserBuddyRelations(userId);
    return count >= this.MAX_BUDDY_RELATIONS;
  }

  // Get the maximum buddy relation limit
  getMaxBuddyLimit(): number {
    return this.MAX_BUDDY_RELATIONS;
  }

  // Send buddy invitation (updated for email-based invitations)
  async sendBuddyInvitation(
    toUserEmail: string, 
    toUserName: string, 
    message: string
  ): Promise<void> {
    try {
      // Get current user info using proper auth service
      const authUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      if (!authUser.uid || !authUser.email) {
        throw new Error('User not properly authenticated');
      }

      const invitation: Omit<BuddyInvitation, 'id'> = {
        fromUserId: authUser.uid,
        fromUserName: authUser.fullName || `${authUser.firstName} ${authUser.lastName}`,
        fromUserEmail: authUser.email,
        toUserId: '', // Will be set when recipient registers
        toUserEmail: toUserEmail,
        toUserName: toUserName,
        message: message,
        status: 'pending',
        createdAt: new Date()
      };

      await addDoc(collection(this.db, 'buddy_invitations'), invitation);
      
      // TODO: Send email notification to recipient with registration link
      // Email should include: invitation details + link to general registration page
      
    } catch (error) {
      console.error('Error sending buddy invitation:', error);
      throw error;
    }
  }

  // Send buddy invitation with user profile data (more reliable)
  async sendBuddyInvitationWithUser(
    currentUser: any,
    targetUser: any,
    message: string
  ): Promise<void> {
    try {
      if (!currentUser || !currentUser.uid || !currentUser.email) {
        throw new Error('Current user data is invalid');
      }

      if (!targetUser || !targetUser.email) {
        throw new Error('Target user data is invalid');
      }

      // Check if user has reached the buddy limit
      const hasReachedLimit = await this.hasReachedBuddyLimit(currentUser.uid);
      if (hasReachedLimit) {
        throw new Error(`You have reached the maximum number of buddy connections (${this.MAX_BUDDY_RELATIONS}). Please remove an existing buddy to add a new one.`);
      }

      const invitation: Omit<BuddyInvitation, 'id'> = {
        fromUserId: currentUser.uid,
        fromUserName: currentUser.fullName || `${currentUser.firstName} ${currentUser.lastName}`,
        fromUserEmail: currentUser.email,
        toUserId: targetUser.uid || '', // Set the recipient's user ID if available
        toUserEmail: targetUser.email,
        toUserName: targetUser.fullName || `${targetUser.firstName} ${targetUser.lastName}`,
        message: message,
        status: 'pending',
        createdAt: new Date()
      };

      await addDoc(collection(this.db, 'buddy_invitations'), invitation);
      
      console.log('Buddy invitation sent successfully:', invitation);
      
    } catch (error) {
      console.error('Error sending buddy invitation with user data:', error);
      throw error;
    }
  }  // Get received invitations for current user
  async getReceivedInvitations(userId: string): Promise<BuddyInvitation[]> {
    try {
      // For now, let's query by both methods to ensure we catch all invitations
      
      // First try by userId (in case it was set properly)
      let q = query(
        collection(this.db, 'buddy_invitations'),
        where('toUserId', '==', userId),
        where('status', '==', 'pending')
      );
      
      let querySnapshot = await getDocs(q);
      if (!environment.production) {
        console.log('Found invitations by userId:', querySnapshot.docs.length);
      }
      
      let invitations = querySnapshot.docs.map(doc => {
        const data = doc.data();
        if (!environment.production) {
          console.log('Invitation data (by userId):', data);
        }
        return { 
          id: doc.id, 
          ...data,
          createdAt: data['createdAt']?.toDate()
        } as BuddyInvitation;
      });

      if (!environment.production) {
        console.log(`Found ${invitations.length} invitations for userId: ${userId}`);
      }
      return invitations;
    } catch (error) {
      console.error('Error getting received invitations:', error);
      return [];
    }
  }

  // Get received invitations by email (for when toUserId is empty)
  async getReceivedInvitationsByEmail(email: string): Promise<BuddyInvitation[]> {
    try {
      if (!environment.production) {
        console.log('Looking for invitations for email:', email);
      }
      
      const q = query(
        collection(this.db, 'buddy_invitations'),
        where('toUserEmail', '==', email),
        where('status', '==', 'pending')
      );
      
      const querySnapshot = await getDocs(q);
      if (!environment.production) {
        console.log('Found invitations by email:', querySnapshot.docs.length);
      }
      
      const invitations = querySnapshot.docs.map(doc => {
        const data = doc.data();
        if (!environment.production) {
          console.log('Invitation data (by email):', data);
        }
        return { 
          id: doc.id, 
          ...data,
          createdAt: data['createdAt']?.toDate()
        } as BuddyInvitation;
      });

      if (!environment.production) {
        console.log(`Found ${invitations.length} invitations for email: ${email}`);
      }
      return invitations;
    } catch (error) {
      console.error('Error getting received invitations:', error);
      return [];
    }
  }

  // Get sent invitations for current user
  async getSentInvitations(userId: string): Promise<BuddyInvitation[]> {
    try {
      const q = query(
        collection(this.db, 'buddy_invitations'),
        where('fromUserId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          createdAt: data['createdAt']?.toDate(),
          respondedAt: data['respondedAt']?.toDate()
        } as BuddyInvitation;
      });
    } catch (error) {
      console.error('Error getting sent invitations:', error);
      return [];
    }
  }

  // Accept buddy invitation
  async acceptBuddyInvitation(invitationId: string): Promise<void> {
    try {
      // Get current user ID first
      const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (!currentUserData.uid) {
        throw new Error('No current user found');
      }
      
      await this.acceptBuddyInvitationWithUser(invitationId, currentUserData.uid);
    } catch (error) {
      console.error('Error accepting buddy invitation:', error);
      throw error;
    }
  }

  // Accept buddy invitation with explicit user ID
  async acceptBuddyInvitationWithUser(invitationId: string, currentUserId: string): Promise<void> {
    try {
      // Check if current user has reached the buddy limit
      const hasReachedLimit = await this.hasReachedBuddyLimit(currentUserId);
      if (hasReachedLimit) {
        throw new Error(`You have reached the maximum number of buddy connections (${this.MAX_BUDDY_RELATIONS}). Please remove an existing buddy to accept a new invitation.`);
      }

      // Update invitation status
      const invitationRef = doc(this.db, 'buddy_invitations', invitationId);
      await updateDoc(invitationRef, {
        status: 'accepted',
        respondedAt: new Date(),
        toUserId: currentUserId // Ensure toUserId is set
      });

      // Get invitation details
      const invitationSnap = await getDoc(invitationRef);
      if (invitationSnap.exists()) {
        const invitation = invitationSnap.data() as BuddyInvitation;
        
        // Create buddy relation - use current user ID
        const relation: Omit<BuddyRelation, 'id'> = {
          user1Id: invitation.fromUserId, // The original sender
          user2Id: currentUserId, // The person accepting (current user)
          status: 'accepted',
          invitationId: invitationId,
          createdAt: new Date(),
          acceptedAt: new Date()
        };
        
        console.log('Creating buddy relation:', relation);
        await addDoc(collection(this.db, 'buddy_relations'), relation);
      }
    } catch (error) {
      console.error('Error accepting buddy invitation with user:', error);
      throw error;
    }
  }

  // Decline buddy invitation
  async declineBuddyInvitation(invitationId: string): Promise<void> {
    try {
      const invitationRef = doc(this.db, 'buddy_invitations', invitationId);
      await updateDoc(invitationRef, {
        status: 'declined',
        respondedAt: new Date()
      });
    } catch (error) {
      console.error('Error declining buddy invitation:', error);
      throw error;
    }
  }

  // Cancel buddy invitation (for sender)
  async cancelBuddyInvitation(invitationId: string): Promise<void> {
    try {
      const invitationRef = doc(this.db, 'buddy_invitations', invitationId);
      await updateDoc(invitationRef, {
        status: 'cancelled',
        respondedAt: new Date()
      });
    } catch (error) {
      console.error('Error cancelling buddy invitation:', error);
      throw error;
    }
  }

  // Check if there's already a buddy relation between two users
  async checkBuddyRelation(otherUserId: string): Promise<BuddyRelation | null> {
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const currentUserId = currentUser.uid;
      
      // Check for relations in both directions
      const q1 = query(
        collection(this.db, 'buddy_relations'),
        where('user1Id', '==', currentUserId),
        where('user2Id', '==', otherUserId)
      );
      
      const q2 = query(
        collection(this.db, 'buddy_relations'),
        where('user1Id', '==', otherUserId),
        where('user2Id', '==', currentUserId)
      );
      
      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      if (!snapshot1.empty) {
        return { id: snapshot1.docs[0].id, ...snapshot1.docs[0].data() } as BuddyRelation;
      }
      
      if (!snapshot2.empty) {
        return { id: snapshot2.docs[0].id, ...snapshot2.docs[0].data() } as BuddyRelation;
      }
      
      return null;
    } catch (error) {
      console.error('Error checking buddy relation:', error);
      return null;
    }
  }

  // Get all connected buddies (from buddy relations)
  async getConnectedBuddies(userId: string): Promise<any[]> {
    try {
      const q1 = query(
        collection(this.db, 'buddy_relations'),
        where('user1Id', '==', userId),
        where('status', '==', 'accepted')
      );
      
      const q2 = query(
        collection(this.db, 'buddy_relations'),
        where('user2Id', '==', userId),
        where('status', '==', 'accepted')
      );
      
      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const connectedUserIds: string[] = [];
      
      snapshot1.docs.forEach(doc => {
        const data = doc.data();
        // Exclude soft-deleted relations
        if (!data['deletedAt']) {
          connectedUserIds.push(data['user2Id']);
        }
      });
      
      snapshot2.docs.forEach(doc => {
        const data = doc.data();
        // Exclude soft-deleted relations
        if (!data['deletedAt']) {
          connectedUserIds.push(data['user1Id']);
        }
      });
      
      // Here you would typically fetch user details for these IDs
      // For now, return the IDs
      return connectedUserIds.map(id => ({ id, connected: true }));
    } catch (error) {
      console.error('Error getting connected buddies:', error);
      return [];
    }
  }

  // Get patients that this user is protecting as an emergency buddy
  async getProtectedPatients(buddyUserId: string): Promise<any[]> {
    try {
      console.log('Loading protected patients for buddy:', buddyUserId);
      
      // Find all buddy relations where this user is user2Id (the emergency responder)
      const q = query(
        collection(this.db, 'buddy_relations'),
        where('user2Id', '==', buddyUserId),
        where('status', '==', 'accepted')
      );
      
      const querySnapshot = await getDocs(q);
      console.log('Found buddy relations:', querySnapshot.docs.length);
      
      if (querySnapshot.empty) {
        return [];
      }
      
      // OPTIMIZATION: Batch user profile queries instead of individual calls
      const patientIds = querySnapshot.docs
        .filter(doc => !doc.data()['deletedAt']) // Exclude soft-deleted relations
        .map(doc => doc.data()['user1Id']);
      const uniquePatientIds = [...new Set(patientIds)]; // Remove duplicates
      
      // Batch fetch user profiles (max 10 per batch due to Firestore 'in' query limit)
      const patients: any[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < uniquePatientIds.length; i += batchSize) {
        const batch = uniquePatientIds.slice(i, i + batchSize);
        
        if (batch.length > 0) {
          // Single query for multiple users
          const userQuery = query(
            collection(this.db, 'users'),
            where('uid', 'in', batch)
          );
          
          const userSnapshot = await getDocs(userQuery);
          const userMap = new Map();
          
          userSnapshot.docs.forEach(doc => {
            const userData = doc.data();
            userMap.set(userData['uid'] || doc.id, userData);
          });
          
          // Process relations with cached user data
          querySnapshot.docs.forEach(relationDoc => {
            const relation = relationDoc.data();
            const patientId = relation['user1Id'];
            
            if (batch.includes(patientId)) {
              const userData = userMap.get(patientId);
              
              const patientInfo = {
                id: patientId,
                userId: patientId,
                relationId: relationDoc.id,
                acceptedAt: relation['acceptedAt']?.toDate(),
                firstName: userData?.firstName || 'Patient',
                lastName: userData?.lastName || `User ${patientId.substring(0, 6)}`,
                email: userData?.email || '',
                relationship: 'Protected Patient'
              };
              
              patients.push(patientInfo);
            }
          });
        }
      }
      
      console.log('Processed patients:', patients);
      return patients;
    } catch (error) {
      console.error('Error getting protected patients:', error);
      return [];
    }
  }

  // Debug method to check all buddy relations
  async debugBuddyRelations(): Promise<void> {
    try {
      console.log('=== DEBUGGING BUDDY RELATIONS (Limited to 50 records) ===');
      
      // Get buddy relations with limit to prevent performance issues
      const q = query(collection(this.db, 'buddy_relations'), limit(50));
      const querySnapshot = await getDocs(q);
      
      console.log('Buddy relations in database (showing first 50):', querySnapshot.docs.length);
      
      querySnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Relation ${index + 1}:`, {
          id: doc.id,
          user1Id: data['user1Id'],
          user2Id: data['user2Id'], 
          status: data['status'],
          acceptedAt: data['acceptedAt']?.toDate(),
          invitationId: data['invitationId']
        });
      });
      
      // Also check invitations with limit
      const invQ = query(collection(this.db, 'buddy_invitations'), limit(50));
      const invSnapshot = await getDocs(invQ);
      
      console.log('=== BUDDY INVITATIONS (Limited to 50 records) ===');
      console.log('Invitations in database (showing first 50):', invSnapshot.docs.length);
      
      invSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`Invitation ${index + 1}:`, {
          id: doc.id,
          fromUserId: data['fromUserId'],
          fromUserEmail: data['fromUserEmail'],
          toUserId: data['toUserId'],
          toUserEmail: data['toUserEmail'],
          status: data['status'],
          createdAt: data['createdAt']?.toDate(),
          acceptedAt: data['acceptedAt']?.toDate()
        });
      });
      
    } catch (error) {
      console.error('Error debugging buddy relations:', error);
    }
  }

  // Helper method to fix any accepted invitations that didn't create buddy relations
  async fixAcceptedInvitations(): Promise<void> {
    try {
      console.log('Checking for accepted invitations without buddy relations...');
      
      // Find all accepted invitations
      const q = query(
        collection(this.db, 'buddy_invitations'),
        where('status', '==', 'accepted')
      );
      
      const querySnapshot = await getDocs(q);
      console.log('Found accepted invitations:', querySnapshot.docs.length);
      
      for (const invitationDoc of querySnapshot.docs) {
        const invitation = invitationDoc.data() as BuddyInvitation;
        const invitationId = invitationDoc.id;
        
        // Check if buddy relation already exists
        const relationQuery = query(
          collection(this.db, 'buddy_relations'),
          where('invitationId', '==', invitationId)
        );
        
        const relationSnapshot = await getDocs(relationQuery);
        
        if (relationSnapshot.empty) {
          console.log('Creating missing buddy relation for invitation:', invitationId);
          
          // For missing buddy relations, we need to find the actual user ID
          // If toUserId is empty, we need to look up the user by email
          let toUserId = invitation.toUserId;
          
          if (!toUserId && invitation.toUserEmail) {
            // TODO: You might want to add a method to look up user by email
            // For now, we'll skip creating relations for invitations without proper user IDs
            console.log('Skipping invitation without proper user ID:', invitationId);
            continue;
          }
          
          if (invitation.fromUserId && toUserId) {
            const relation: Omit<BuddyRelation, 'id'> = {
              user1Id: invitation.fromUserId,
              user2Id: toUserId,
              status: 'accepted',
              invitationId: invitationId,
              createdAt: invitation.createdAt || new Date(),
              acceptedAt: invitation.respondedAt || new Date(),
              deletedAt: undefined // Ensure new relations are not soft-deleted
            };
            
            await addDoc(collection(this.db, 'buddy_relations'), relation);
            console.log('Created buddy relation for invitation:', invitationId);
          }
        } else {
          // Check if the existing relation is soft-deleted and restore it
          const existingRelation = relationSnapshot.docs[0];
          if (existingRelation.data()['deletedAt']) {
            await updateDoc(existingRelation.ref, {
              deletedAt: null // Remove soft-delete marker
            });
            console.log('Restored soft-deleted buddy relation for invitation:', invitationId);
          }
        }
      }
    } catch (error) {
      console.error('Error fixing accepted invitations:', error);
    }
  }

  // Listen for real-time buddy invitation changes
  listenForBuddyInvitations(userEmail: string): () => void {
    try {
      // Prevent duplicate listeners for the same email
      if (this.invitationListeners.has(userEmail)) {
        if (!environment.production) {
          console.log('Invitation listener already exists for email:', userEmail);
        }
        return () => {}; // Return empty unsubscribe function
      }
      
      if (!environment.production) {
        console.log('Setting up real-time listener for buddy invitations:', userEmail);
      }
      
      // Mark this email as having an active listener
      this.invitationListeners.add(userEmail);
      
      // Listen for invitations sent to this user's email
      const q = query(
        collection(this.db, 'buddy_invitations'),
        where('toUserEmail', '==', userEmail),
        where('status', '==', 'pending')
      );
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const invitations: BuddyInvitation[] = [];
        
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          invitations.push({
            id: doc.id,
            ...data,
            createdAt: data['createdAt']?.toDate(),
            respondedAt: data['respondedAt']?.toDate()
          } as BuddyInvitation);
        });
        
        if (!environment.production) {
          console.log('Real-time invitations update:', invitations.length);
        }
        this.pendingInvitationsSubject.next(invitations);
      });
      
      // Return unsubscribe function with cleanup
      return () => {
        unsubscribe();
        // Remove listener from active set when unsubscribed
        this.invitationListeners.delete(userEmail);
      };
    } catch (error) {
      console.error('Error setting up invitation listener:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  // Listen for real-time buddy relation changes
  listenForBuddyRelations(userId: string): () => void {
    try {
      // Prevent duplicate listeners for the same user
      if (this.relationListeners.has(userId)) {
        if (!environment.production) {
          console.log('Buddy relation listener already exists for user:', userId);
        }
        return () => {}; // Return empty unsubscribe function
      }
      
      if (!environment.production) {
        console.log('Setting up optimized real-time listener for buddy relations:', userId);
      }
      
      // Mark this user as having an active listener
      this.relationListeners.add(userId);
      
      // Use a single listener that combines both queries to reduce API calls
      // Listen for all relations where user is either user1 or user2
      const q1 = query(
        collection(this.db, 'buddy_relations'),
        where('user1Id', '==', userId),
        where('status', '==', 'accepted')
      );
      
      const q2 = query(
        collection(this.db, 'buddy_relations'),
        where('user2Id', '==', userId),
        where('status', '==', 'accepted')
      );
      
      // Track relations from both queries
      let user1Relations: any[] = [];
      let user2Relations: any[] = [];
      
      const unsubscribe1 = onSnapshot(q1, (querySnapshot) => {
        user1Relations = querySnapshot.docs
          .filter(doc => !doc.data()['deletedAt']) // Exclude soft-deleted relations
          .map(doc => ({ id: doc.id, ...doc.data() }));
        this.handleOptimizedRelationSnapshot(user1Relations, user2Relations, userId);
      });
      
      const unsubscribe2 = onSnapshot(q2, (querySnapshot) => {
        user2Relations = querySnapshot.docs
          .filter(doc => !doc.data()['deletedAt']) // Exclude soft-deleted relations
          .map(doc => ({ id: doc.id, ...doc.data() }));
        this.handleOptimizedRelationSnapshot(user1Relations, user2Relations, userId);
      });
      
      // Return combined unsubscribe function
      return () => {
        unsubscribe1();
        unsubscribe2();
        // Remove listener from active set when unsubscribed
        this.relationListeners.delete(userId);
      };
    } catch (error) {
      console.error('Error setting up buddy relation listener:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  private handleOptimizedRelationSnapshot(user1Relations: any[], user2Relations: any[], userId: string) {
    // Combine relations from both queries and process snapshot data directly
    // This eliminates the need for additional getBuddyRelationsForUser() API calls
    const allRelations = [...user1Relations, ...user2Relations];
    
    if (!environment.production) {
      console.log('Optimized real-time buddy relations update:', allRelations.length);
    }
    this.buddyRelationsSubject.next(allRelations);
  }
}

