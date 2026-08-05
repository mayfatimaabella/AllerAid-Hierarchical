import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './firebase.config';
import { UserService } from './user.service';
import { Buddy } from '../models/buddy.model';

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { BehaviorSubject } from 'rxjs';

export interface BuddyInvitation {
  id?: string;
  fromUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  toUserId: string;
  toUserEmail: string;
  toUserName: string;
  message: string;
  relationship?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: Date;
  respondedAt?: Date;
}

interface BuddyReference {
  id?: string;
  buddyUid?: string;
  connectedUserId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BuddyService {
  private db;
  private functions;
  private auth;

  private readonly MAX_BUDDY_RELATIONS = 10;

  private activeEmergencyAlertsSubject = new BehaviorSubject<any[]>([]);
  activeEmergencyAlerts$ = this.activeEmergencyAlertsSubject.asObservable();

  private pendingInvitationsSubject = new BehaviorSubject<BuddyInvitation[]>([]);
  pendingInvitations$ = this.pendingInvitationsSubject.asObservable();

  private sentInvitationsSubject = new BehaviorSubject<BuddyInvitation[]>([]);
  sentInvitations$ = this.sentInvitationsSubject.asObservable();

  private buddyRelationsSubject = new BehaviorSubject<Buddy[]>([]);
  buddyRelations$ = this.buddyRelationsSubject.asObservable();

  // ── Subjects for buddy-accepted notifications ──────────────────────────────
  private buddyAcceptedNotificationsSubject = new BehaviorSubject<any[]>([]);
  buddyAcceptedNotifications$ = this.buddyAcceptedNotificationsSubject.asObservable();

  private notifiedAcceptances = new Set<string>();

  private relationsListenerUnsubscribe?: () => void;
  private acceptedNotifUnsubscribe?: () => void;

  hasBeenNotified(buddyUid: string): boolean {
    return this.notifiedAcceptances.has(buddyUid);
  }

  markAsNotified(buddyUid: string): void {
    this.notifiedAcceptances.add(buddyUid);
  }

  constructor(private userService: UserService) {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    this.functions = getFunctions(app, 'us-central1');
    this.auth = getAuth(app);
  }

  // ── Buddy limit helpers ────────────────────────────────────────────────────

  async countUserBuddyRelations(userId: string): Promise<number> {
    const buddiesRef = collection(this.db, 'users', userId, 'buddies');
    const q = query(buddiesRef, where('status', '==', 'accepted'));
    const snap = await getDocs(q);
    return snap.size;
  }

  async hasReachedBuddyLimit(userId: string): Promise<boolean> {
    const count = await this.countUserBuddyRelations(userId);
    return count >= this.MAX_BUDDY_RELATIONS;
  }

  getMaxBuddyLimit(): number {
    return this.MAX_BUDDY_RELATIONS;
  }

  // ── Duplicate check ────────────────────────────────────────────────────────

  async checkDuplicateBuddyByEmail(
    currentUserId: string,
    targetEmail: string
  ): Promise<{ isDuplicate: boolean; type: string; details?: any }> {
    const targetEmailLower = targetEmail.toLowerCase().trim();

    const buddiesRef = collection(this.db, 'users', currentUserId, 'buddies');
    const buddiesSnap = await getDocs(buddiesRef);

    for (const buddyDoc of buddiesSnap.docs) {
      const buddy: any = buddyDoc.data();
      if (buddy.buddyEmail?.toLowerCase() === targetEmailLower) {
        return {
          isDuplicate: true,
          type: 'existing_buddy',
          details: { name: buddy.buddyName || targetEmailLower }
        };
      }
    }

    const sentInvitesRef = collection(this.db, 'users', currentUserId, 'sentBuddyInvitations');
    const sentQ = query(
      sentInvitesRef,
      where('toUserEmail', '==', targetEmailLower),
      where('status', '==', 'pending')
    );
    const sentSnap = await getDocs(sentQ);

    if (!sentSnap.empty) {
      const invitation: any = sentSnap.docs[0].data();
      return {
        isDuplicate: true,
        type: 'pending_sent_invitation',
        details: { name: invitation.toUserName || targetEmailLower }
      };
    }

    const receivedInvitesRef = collection(this.db, 'users', currentUserId, 'receivedBuddyInvitations');
    const receivedQ = query(
      receivedInvitesRef,
      where('fromUserEmail', '==', targetEmailLower),
      where('status', '==', 'pending')
    );
    const receivedSnap = await getDocs(receivedQ);

    if (!receivedSnap.empty) {
      const invitation: any = receivedSnap.docs[0].data();
      return {
        isDuplicate: true,
        type: 'pending_received_invitation',
        details: { name: invitation.fromUserName || targetEmailLower }
      };
    }

    return { isDuplicate: false, type: 'none' };
  }

  // ── Send invitations ───────────────────────────────────────────────────────

  async sendBuddyInvitationWithUser(
    currentUser: any,
    targetUser: any,
    message: string,
    relationship: string = 'Emergency Buddy'
  ): Promise<string> {
    if (!currentUser?.uid || !currentUser?.email) {
      throw new Error('Current user data is invalid.');
    }
    if (!targetUser?.uid || !targetUser?.email) {
      throw new Error('Target user data is invalid.');
    }
    if (currentUser.uid === targetUser.uid) {
      throw new Error('You cannot invite yourself as a buddy.');
    }

    const hasReachedLimit = await this.hasReachedBuddyLimit(currentUser.uid);
    if (hasReachedLimit) {
      throw new Error(
        `You have reached the maximum number of buddy connections (${this.MAX_BUDDY_RELATIONS}).`
      );
    }

    const inviteId = `${currentUser.uid}_${targetUser.uid}`;

    const invitationData: BuddyInvitation = {
      id: inviteId,
      fromUserId: currentUser.uid,
      fromUserName:
        currentUser.fullName ||
        `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
      fromUserEmail: currentUser.email.toLowerCase(),
      toUserId: targetUser.uid,
      toUserEmail: targetUser.email.toLowerCase(),
      toUserName:
        targetUser.fullName ||
        `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
      message,
      relationship,
      status: 'pending',
      createdAt: new Date()
    };

    await setDoc(
      doc(this.db, 'users', currentUser.uid, 'sentBuddyInvitations', inviteId),
      invitationData
    );
    await setDoc(
      doc(this.db, 'users', targetUser.uid, 'receivedBuddyInvitations', inviteId),
      invitationData
    );

    return inviteId;
  }

  async sendBuddyInvitation(
    toUserEmail: string,
    toUserName: string,
    message: string
  ): Promise<void> {
    const authUser = this.auth.currentUser;
    if (!authUser?.uid || !authUser.email) {
      throw new Error('User not properly authenticated.');
    }

    const senderProfile = await this.userService.getUserProfile(authUser.uid, false);
    const fromUserName =
      senderProfile?.fullName ||
      `${senderProfile?.firstName || ''} ${senderProfile?.lastName || ''}`.trim() ||
      authUser.email;

    const inviteId = `${authUser.uid}_${toUserEmail.toLowerCase()}`;

    const invitationData: BuddyInvitation = {
      id: inviteId,
      fromUserId: authUser.uid,
      fromUserName,
      fromUserEmail: authUser.email.toLowerCase(),
      toUserId: '',
      toUserEmail: toUserEmail.toLowerCase(),
      toUserName,
      message,
      status: 'pending',
      createdAt: new Date()
    };

    await setDoc(
      doc(this.db, 'users', authUser.uid, 'sentBuddyInvitations', inviteId),
      invitationData
    );
  }

  // ── Accept invitation ──────────────────────────────────────────────────────

  async acceptBuddyInvitation(invitationId: string): Promise<void> {
    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUserData.uid) {
      throw new Error('No current user found.');
    }
    await this.acceptBuddyInvitationWithUser(invitationId, currentUserData.uid);
  }

  async acceptBuddyInvitationWithUser(
    invitationId: string,
    currentUserId: string
  ): Promise<void> {
    const hasReachedLimit = await this.hasReachedBuddyLimit(currentUserId);
    if (hasReachedLimit) {
      throw new Error(
        `You have reached the maximum number of buddy connections (${this.MAX_BUDDY_RELATIONS}).`
      );
    }

    const receivedInviteRef = doc(
      this.db,
      'users',
      currentUserId,
      'receivedBuddyInvitations',
      invitationId
    );

    const inviteSnap = await getDoc(receivedInviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('Invitation not found.');
    }

    const invitation: any = inviteSnap.data();

    const senderUid   = invitation.fromUserId;  // B2 — ang nag-send
    const receiverUid = currentUserId;           // B1 — ang nag-accept

    if (senderUid === receiverUid) {
      throw new Error('Invalid buddy relation.');
    }

    const senderRelationship   = invitation.relationship || 'Emergency Buddy';
    const receiverRelationship = this.getInverseRelationship(senderRelationship);

    const acceptedAt = new Date();

    // 1. Update invitation status on both sides
    await updateDoc(receivedInviteRef, {
      status: 'accepted',
      respondedAt: acceptedAt,
      toUserId: receiverUid
    });

    await updateDoc(
      doc(this.db, 'users', senderUid, 'sentBuddyInvitations', invitationId),
      { status: 'accepted', respondedAt: acceptedAt, toUserId: receiverUid }
    );

    // 2. Create buddy relation on both sides
    await setDoc(
      doc(this.db, 'users', senderUid, 'buddies', receiverUid),
      {
        buddyUid:        receiverUid,
        buddyEmail:      invitation.toUserEmail,
        buddyName:       invitation.toUserName,
        requesterUid:    senderUid,
        responderUid:    receiverUid,
        relationship:    senderRelationship,
        status:          'accepted',
        invitationId,
        createdAt:       invitation.createdAt,
        acceptedAt
      }
    );

    await setDoc(
      doc(this.db, 'users', receiverUid, 'buddies', senderUid),
      {
        buddyUid:        senderUid,
        buddyEmail:      invitation.fromUserEmail,
        buddyName:       invitation.fromUserName,
        requesterUid:    senderUid,
        responderUid:    receiverUid,
        relationship:    receiverRelationship,
        status:          'accepted',
        invitationId,
        createdAt:       invitation.createdAt,
        acceptedAt
      }
    );

    // 3. ── Notify B2 that B1 accepted ──────────────────────────────────────
    //    Write to users/{B2}/notifications so B2's real-time listener fires.
    const notifRef = doc(
      collection(this.db, 'users', senderUid, 'notifications')
    );

    await setDoc(notifRef, {
      id:           notifRef.id,
      type:         'buddy_accepted',
      message:      `${invitation.toUserName} accepted your buddy invitation!`,
      fromUserId:   receiverUid,
      fromUserName: invitation.toUserName,
      read:         false,
      createdAt:    new Date()
    });
  }

  // ── Decline / Cancel / Delete ──────────────────────────────────────────────

  async declineBuddyInvitation(invitationId: string): Promise<void> {
    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUserData.uid) {
      throw new Error('No current user found.');
    }

    const inviteRef = doc(
      this.db,
      'users',
      currentUserData.uid,
      'receivedBuddyInvitations',
      invitationId
    );

    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('Invitation not found.');
    }

    const invitation: any = inviteSnap.data();
    const respondedAt = new Date();

    await updateDoc(inviteRef, { status: 'declined', respondedAt });

    await updateDoc(
      doc(this.db, 'users', invitation.fromUserId, 'sentBuddyInvitations', invitationId),
      { status: 'declined', respondedAt }
    );
  }

  async cancelBuddyInvitation(invitationId: string): Promise<void> {
    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUserData.uid) {
      throw new Error('No current user found.');
    }

    const sentInviteRef = doc(
      this.db,
      'users',
      currentUserData.uid,
      'sentBuddyInvitations',
      invitationId
    );

    const inviteSnap = await getDoc(sentInviteRef);
    if (!inviteSnap.exists()) {
      throw new Error('Invitation not found.');
    }

    const invitation: any = inviteSnap.data();
    const respondedAt = new Date();

    await updateDoc(sentInviteRef, { status: 'cancelled', respondedAt });

    if (invitation.toUserId) {
      await updateDoc(
        doc(this.db, 'users', invitation.toUserId, 'receivedBuddyInvitations', invitationId),
        { status: 'cancelled', respondedAt }
      );
    }
  }

  async deleteBuddy(buddyToDelete: BuddyReference): Promise<void> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const currentUserId = currentUser.uid;

    const buddyUid =
      buddyToDelete.buddyUid ||
      buddyToDelete.connectedUserId ||
      buddyToDelete.id;

    if (!currentUserId || !buddyUid) {
      throw new Error('Missing user or buddy ID.');
    }

    const inviteId1 = `${currentUserId}_${buddyUid}`;
    const inviteId2 = `${buddyUid}_${currentUserId}`;

    await deleteDoc(doc(this.db, 'users', currentUserId, 'buddies', buddyUid));
    await deleteDoc(doc(this.db, 'users', buddyUid, 'buddies', currentUserId));

    await deleteDoc(doc(this.db, 'users', currentUserId, 'sentBuddyInvitations', inviteId1));
    await deleteDoc(doc(this.db, 'users', buddyUid, 'receivedBuddyInvitations', inviteId1));
    
    await deleteDoc(doc(this.db, 'users', buddyUid, 'sentBuddyInvitations', inviteId2));
    await deleteDoc(doc(this.db, 'users', currentUserId, 'receivedBuddyInvitations', inviteId2));
  }

  async getUserBuddies(userId: string): Promise<Buddy[]> { 
    const buddiesRef = collection(this.db, 'users', userId, 'buddies');
    const q = query(buddiesRef, where('status', '==', 'accepted'));
    const snap = await getDocs(q);

    return snap.docs.map(docSnap =>({id: docSnap.id, ...docSnap.data(),isFromRelation: true}) as Buddy).filter(buddy => buddy.buddyUid !== userId);}

  async getConnectedBuddies(userId: string): Promise<Buddy[]> {
    return this.getUserBuddies(userId);
  }

  async getProtectedPatients(buddyUserId: string): Promise<any[]> {
    const buddies = await this.getUserBuddies(buddyUserId);

    return buddies
      .filter((buddy: Buddy) => buddy.relationship === 'Protected Patient')
      .map((buddy: Buddy) => ({
        id:           buddy.buddyUid,
        userId:       buddy.buddyUid,
        firstName:    buddy.buddyName?.split(' ')[0] || 'Patient',
        lastName:     buddy.buddyName?.split(' ').slice(1).join(' ') || '',
        email:        buddy.buddyEmail || '',
        relationship: 'Protected Patient',
        acceptedAt:   buddy.acceptedAt
      }));
  }

  async getReceivedInvitations(userId: string): Promise<BuddyInvitation[]> {
    const invitationsRef = collection(this.db, 'users', userId, 'receivedBuddyInvitations');
    const snap = await getDocs(query(invitationsRef));

    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as BuddyInvitation[];
  }

  async getReceivedInvitationsByEmail(email: string): Promise<BuddyInvitation[]> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (!currentUser.uid) return [];

    const invitations = await this.getReceivedInvitations(currentUser.uid);
    return invitations.filter(
      invite => invite.toUserEmail?.toLowerCase() === email.toLowerCase()
    );
  }

  async getSentInvitations(userId: string): Promise<BuddyInvitation[]> {
    const invitationsRef = collection(this.db, 'users', userId, 'sentBuddyInvitations');
    const snap = await getDocs(invitationsRef);

    const validInvitations: BuddyInvitation[] = [];

    for (const docSnap of snap.docs) {
      const invitation = { id: docSnap.id, ...docSnap.data() } as BuddyInvitation;

      if (invitation.status === 'accepted') {
        const buddyRef  = doc(this.db, 'users', userId, 'buddies', invitation.toUserId);
        const buddySnap = await getDoc(buddyRef);

        if (!buddySnap.exists()) {
          await deleteDoc(docSnap.ref);
          continue;
        }
      }

      validInvitations.push(invitation);
    }

    return validInvitations;
  }

  // ── Real-time listeners ────────────────────────────────────────────────────

  listenForBuddyInvitations(userId: string): () => void {
    const invitationsRef = collection(this.db, 'users', userId, 'receivedBuddyInvitations');

    return onSnapshot(query(invitationsRef), snapshot => {
      const invitations = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as BuddyInvitation[];

      this.pendingInvitationsSubject.next(invitations);
    });
  }

  listenForSentInvitations(userId: string): () => void {
    const invitationsRef = collection(this.db, 'users', userId, 'sentBuddyInvitations');

    return onSnapshot(query(invitationsRef), snapshot => {
      const invitations = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as BuddyInvitation[];

      this.sentInvitationsSubject.next(invitations);
    });
  }

  listenForBuddyRelations(userId: string): void {
    this.relationsListenerUnsubscribe?.();

    const buddiesRef = collection(this.db, 'users', userId, 'buddies');
    const q = query(buddiesRef, where('status', '==', 'accepted'));

    this.relationsListenerUnsubscribe = onSnapshot(q, snapshot => {
      const buddies: Buddy[] = snapshot.docs.map(
        docSnap =>
          ({
            id: docSnap.id,
            ...docSnap.data()
          }) as Buddy
      );

      this.buddyRelationsSubject.next(buddies);
    });
  }

  stopBuddyRelationsListener(): void {
    this.relationsListenerUnsubscribe?.();
    this.relationsListenerUnsubscribe = undefined;
  }

  /**
   * listenForBuddyAcceptedNotifications
   *
   * Called on B2's side (the one who sent the original invite).
   * Watches users/{B2}/notifications for type === 'buddy_accepted'.
   *
   * When B1 accepts, acceptBuddyInvitationWithUser() writes a notification
   * document there — this snapshot fires and:
   *   1. Emits the notification through buddyAcceptedNotifications$
   *   2. Refreshes the buddy relations list (buddyRelations$)
   *   3. Marks the buddy as notified to prevent duplicate toasts
   *
   * Returns an unsubscribe function so the caller can clean up.
   */
  listenForBuddyAcceptedNotifications(userId: string): () => void {
    // Stop any previous listener first
    this.acceptedNotifUnsubscribe?.();

    const notifsRef = collection(this.db, 'users', userId, 'notifications');
    const q = query(
      notifsRef,
      where('type',  '==', 'buddy_accepted'),
      where('read',  '==', false)
    );

    const unsubscribe = onSnapshot(q, snapshot => {
      const notifications: any[] = [];

      snapshot.docChanges().forEach(change => {
        if (change.type !== 'added') return;

        const notif    = { id: change.doc.id, ...change.doc.data() };
        const buddyUid = (notif as any).fromUserId as string;

        notifications.push(notif);

        // Avoid duplicate toasts for the same buddy acceptance
        if (buddyUid && !this.hasBeenNotified(buddyUid)) {
          this.markAsNotified(buddyUid);

          // Refresh buddy list so B2 sees the new buddy immediately
          this.listenForBuddyRelations(userId);
        }
      });

      if (notifications.length > 0) {
        // Merge with existing unread notifications
        const current = this.buddyAcceptedNotificationsSubject.value;
        const merged  = [...current, ...notifications].filter(
          (n, i, arr) => arr.findIndex(x => x.id === n.id) === i
        );
        this.buddyAcceptedNotificationsSubject.next(merged);
      }
    });

    this.acceptedNotifUnsubscribe = unsubscribe;
    return unsubscribe;
  }

  stopAcceptedNotificationsListener(): void {
    this.acceptedNotifUnsubscribe?.();
    this.acceptedNotifUnsubscribe = undefined;
  }

  /**
   * markBuddyNotificationAsRead
   *
   * Call this after showing the toast / UI so the listener won't re-fire
   * for the same document on next app open.
   */
  async markBuddyNotificationAsRead(userId: string, notificationId: string): Promise<void> {
    try {
      await updateDoc(
        doc(this.db, 'users', userId, 'notifications', notificationId),
        { read: true }
      );
    } catch (error) {
      console.warn('Could not mark buddy notification as read:', error);
    }
  }

  // ── Emergency listeners ────────────────────────────────────────────────────

  listenForEmergencyAlerts(userId: string): void {
    const emergenciesRef = collection(this.db, 'emergencies');

    const q = query(
      emergenciesRef,
      where('buddyIds', 'array-contains', userId),
      where('status', 'in', ['active', 'responding'])
    );

    onSnapshot(q, snapshot => {
      const emergencies: any[] = [];

      const dismissedKey  = `dismissedEmergencies_${userId}`;
      const dismissedList: string[] = JSON.parse(
        localStorage.getItem(dismissedKey) || '[]'
      );
      const dismissedSet = new Set(dismissedList);

      snapshot.forEach(docSnap => {
        const emergency = { id: docSnap.id, ...docSnap.data() };
        if (!dismissedSet.has(emergency.id)) {
          emergencies.push(emergency);
        }
      });

      this.activeEmergencyAlertsSubject.next(emergencies);
    });
  }

  // ── Cloud Function wrapper ─────────────────────────────────────────────────

  async sendBuddyInvitationViaFunction(
    currentUser: any,
    targetEmail: string,
    message: string
  ): Promise<void> {
    const sendBuddyInvitation = httpsCallable(this.functions, 'sendBuddyInvitationFunction');

    await sendBuddyInvitation({
      currentUserUid:  currentUser.uid,
      currentUserEmail: currentUser.email,
      currentUserName:
        currentUser.fullName ||
        `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
      targetEmail,
      message
    });
  }

  // ── Emergency dismissal helpers ────────────────────────────────────────────

  dismissEmergencyForUser(userId: string, emergencyId: string): void {
    try {
      const key  = `dismissedEmergencies_${userId}`;
      const list: string[] = JSON.parse(localStorage.getItem(key) || '[]');

      if (!list.includes(emergencyId)) {
        list.push(emergencyId);
        localStorage.setItem(key, JSON.stringify(list));
      }

      const current = this.activeEmergencyAlertsSubject.value;
      this.activeEmergencyAlertsSubject.next(current.filter(e => e.id !== emergencyId));
    } catch (e) {
      console.warn('Failed to persist emergency dismissal', e);
    }
  }

  saveDismissedAlertData(userId: string, alert: any): void {
    try {
      const key     = `dismissedAlerts_${userId}`;
      const current: any[] = JSON.parse(localStorage.getItem(key) || '[]');

      const minimal = {
        id:           alert.id,
        status:       alert.status,
        createdAt:    alert.createdAt || alert.timestamp || new Date().toISOString(),
        location:     alert.location  || null,
        patientId:    alert.patientId || null,
        patientName:  alert.patientName || alert.userName || 'Unknown',
        responderId:  alert.responderId  || null,
        responderName: alert.responderName || null,
        dismissedAt:  new Date().toISOString()
      };

      const exists  = current.find(a => a.id === minimal.id);
      const updated = exists
        ? current.map(a => (a.id === minimal.id ? minimal : a))
        : [...current, minimal];

      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist dismissed alert data', e);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private getInverseRelationship(relationship: string): string {
    switch (relationship) {
      case 'Doctor':
        return 'Patient';
      case 'Family':
      case 'Family Member':
        return 'Family Member';
      case 'Friend':
        return 'Friend';
      case 'Roommate':
        return 'Roommate';
      case 'Coworker':
        return 'Coworker';
      case 'Partner':
        return 'Partner';
      default:
        return 'Protected Patient';
    }
  }
}