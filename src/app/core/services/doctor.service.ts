import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './firebase.config';
import { UserService } from './user.service';

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
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

import { getFunctions, httpsCallable } from 'firebase/functions';
import { BehaviorSubject } from 'rxjs';

export interface DoctorInvitation {
  id?: string;
  fromUserId: string;
  fromUserName: string;
  fromUserEmail: string;
  toUserId: string;
  toUserEmail: string;
  toUserName: string;
  message: string;
  specialization?: string;
  relationship?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: Date;
  respondedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class DoctorService {
  private db;
  private functions;
  private auth;

  private readonly MAX_DOCTOR_RELATIONS = 10;

  private pendingInvitationsSubject = new BehaviorSubject<DoctorInvitation[]>([]);
  pendingInvitations$ = this.pendingInvitationsSubject.asObservable();

  private doctorRelationsSubject = new BehaviorSubject<any[]>([]);
  doctorRelations$ = this.doctorRelationsSubject.asObservable();

  private notifiedAcceptances = new Set<string>();

  hasBeenNotified(doctorUid: string): boolean {
    return this.notifiedAcceptances.has(doctorUid);
  }

  markAsNotified(doctorUid: string): void {
    this.notifiedAcceptances.add(doctorUid);
  }

  constructor(private userService: UserService) {
    const app = initializeApp(firebaseConfig);
    this.db = getFirestore(app);
    this.functions = getFunctions(app, 'us-central1');
    this.auth = getAuth(app);
  }

  async countUserDoctorRelations(userId: string): Promise<number> {
    const doctorsRef = collection(this.db, 'users', userId, 'doctors');
    const q = query(doctorsRef, where('status', '==', 'accepted'));
    const snap = await getDocs(q);

    return snap.size;
  }

  async hasReachedDoctorLimit(userId: string): Promise<boolean> {
    const count = await this.countUserDoctorRelations(userId);
    return count >= this.MAX_DOCTOR_RELATIONS;
  }

  getMaxDoctorLimit(): number {
    return this.MAX_DOCTOR_RELATIONS;
  }

  async checkDuplicateDoctorByEmail(
    currentUserId: string,
    targetEmail: string
  ): Promise<{ isDuplicate: boolean; type: string; details?: any }> {
    const targetEmailLower = targetEmail.toLowerCase().trim();

    const doctorsRef = collection(this.db, 'users', currentUserId, 'doctors');
    const doctorsSnap = await getDocs(doctorsRef);

    for (const doctorDoc of doctorsSnap.docs) {
      const doctor: any = doctorDoc.data();

      if (doctor.doctorEmail?.toLowerCase() === targetEmailLower) {
        return {
          isDuplicate: true,
          type: 'existing_doctor',
          details: {
            name: doctor.doctorName || targetEmailLower
          }
        };
      }
    }

    const sentInvitesRef = collection(
      this.db,
      'users',
      currentUserId,
      'sentDoctorInvitations'
    );

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
        details: {
          name: invitation.toUserName || targetEmailLower
        }
      };
    }

    const receivedInvitesRef = collection(
      this.db,
      'users',
      currentUserId,
      'receivedDoctorInvitations'
    );

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
        details: {
          name: invitation.fromUserName || targetEmailLower
        }
      };
    }

    return {
      isDuplicate: false,
      type: 'none'
    };
  }

  async sendDoctorInvitationWithUser(
    currentUser: any,
    targetUser: any,
    message: string,
    specialization: string = ''
  ): Promise<string> {
    if (!currentUser?.uid || !currentUser?.email) {
      throw new Error('Current user data is invalid.');
    }

    if (!targetUser?.uid || !targetUser?.email) {
      throw new Error('Target user data is invalid.');
    }

    if (currentUser.uid === targetUser.uid) {
      throw new Error('You cannot invite yourself as a doctor.');
    }

    const hasReachedLimit = await this.hasReachedDoctorLimit(currentUser.uid);

    if (hasReachedLimit) {
      throw new Error(
        `You have reached the maximum number of doctor connections (${this.MAX_DOCTOR_RELATIONS}).`
      );
    }

    const inviteId = `${currentUser.uid}_${targetUser.uid}`;

    const invitationData: DoctorInvitation = {
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
      specialization,
      relationship: 'Doctor',
      status: 'pending',
      createdAt: new Date()
    };

    await setDoc(
      doc(this.db, 'users', currentUser.uid, 'sentDoctorInvitations', inviteId),
      invitationData
    );

    await setDoc(
      doc(this.db, 'users', targetUser.uid, 'receivedDoctorInvitations', inviteId),
      invitationData
    );

    return inviteId;
  }

  async sendDoctorInvitation(
    toUserEmail: string,
    toUserName: string,
    message: string,
    specialization: string = ''
  ): Promise<void> {
    const authUser = this.auth.currentUser;

    if (!authUser?.uid || !authUser.email) {
      throw new Error('User not properly authenticated.');
    }

    const senderProfile = await this.userService.getUserProfile(authUser.uid, false);
    const fromUserName = senderProfile?.fullName
      || `${senderProfile?.firstName || ''} ${senderProfile?.lastName || ''}`.trim()
      || authUser.email;

    const inviteId = `${authUser.uid}_${toUserEmail.toLowerCase()}`;

    const invitationData: DoctorInvitation = {
      id: inviteId,
      fromUserId: authUser.uid,
      fromUserName,
      fromUserEmail: authUser.email.toLowerCase(),
      toUserId: '',
      toUserEmail: toUserEmail.toLowerCase(),
      toUserName,
      message,
      specialization,
      relationship: 'Doctor',
      status: 'pending',
      createdAt: new Date()
    };

    await setDoc(
      doc(this.db, 'users', authUser.uid, 'sentDoctorInvitations', inviteId),
      invitationData
    );
  }

  async acceptDoctorInvitation(invitationId: string): Promise<void> {
    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!currentUserData.uid) {
      throw new Error('No current user found.');
    }

    await this.acceptDoctorInvitationWithUser(invitationId, currentUserData.uid);
  }

  async acceptDoctorInvitationWithUser(
    invitationId: string,
    currentUserId: string
  ): Promise<void> {
    const hasReachedLimit = await this.hasReachedDoctorLimit(currentUserId);

    if (hasReachedLimit) {
      throw new Error(
        `You have reached the maximum number of doctor connections (${this.MAX_DOCTOR_RELATIONS}).`
      );
    }

    const receivedInviteRef = doc(
      this.db,
      'users',
      currentUserId,
      'receivedDoctorInvitations',
      invitationId
    );

    const inviteSnap = await getDoc(receivedInviteRef);

    if (!inviteSnap.exists()) {
      throw new Error('Invitation not found.');
    }

    const invitation: any = inviteSnap.data();

    const senderUid = invitation.fromUserId;
    const receiverUid = currentUserId;

    if (senderUid === receiverUid) {
      throw new Error('Invalid doctor relation.');
    }

    const acceptedAt = new Date();

    await updateDoc(receivedInviteRef, {
      status: 'accepted',
      respondedAt: acceptedAt,
      toUserId: receiverUid
    });

    await updateDoc(
      doc(this.db, 'users', senderUid, 'sentDoctorInvitations', invitationId),
      {
        status: 'accepted',
        respondedAt: acceptedAt,
        toUserId: receiverUid
      }
    );

    await setDoc(
      doc(this.db, 'users', senderUid, 'doctors', receiverUid),
      {
        doctorUid: receiverUid,
        doctorEmail: invitation.toUserEmail,
        doctorName: invitation.toUserName,
        specialization: invitation.specialization || '',
        relationship: 'Doctor',
        status: 'accepted',
        invitationId,
        createdAt: invitation.createdAt,
        acceptedAt
      }
    );

    await setDoc(
      doc(this.db, 'users', receiverUid, 'doctors', senderUid),
      {
        doctorUid: senderUid,
        doctorEmail: invitation.fromUserEmail,
        doctorName: invitation.fromUserName,
        specialization: invitation.specialization || '',
        relationship: 'Patient',
        status: 'accepted',
        invitationId,
        createdAt: invitation.createdAt,
        acceptedAt
      }
    );

    // Update patient's EHR record to add doctor as healthcare provider
    try {
      const doctorDoc = await getDoc(doc(this.db, `users/${senderUid}`));
      const doctorData = doctorDoc.data();

      const patientEHRRef = doc(this.db, `users/${receiverUid}/healthRecords/summary`);
      const patientEHR = await getDoc(patientEHRRef);

      if (patientEHR.exists() && doctorData) {
        const ehrData = patientEHR.data() as any;
        const healthcareProviders = ehrData.healthcareProviders || [];

        const alreadyExists = healthcareProviders.some(
          (p: any) => p.email === invitation.fromUserEmail
        );

        if (!alreadyExists) {
          healthcareProviders.push({
            email: invitation.fromUserEmail,
            role: 'doctor',
            name: invitation.fromUserName,
            license: doctorData['license'],
            specialty: invitation.specialization || doctorData['specialty'],
            hospital: doctorData['hospital'],
            grantedAt: serverTimestamp(),
            grantedBy: receiverUid
          });

          await updateDoc(patientEHRRef, {
            healthcareProviders,
            lastUpdated: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Error updating patient EHR with doctor access:', error);
      // Don't throw - the invitation acceptance is complete, this is just an EHR update
    }
  }

  async declineDoctorInvitation(invitationId: string): Promise<void> {
    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!currentUserData.uid) {
      throw new Error('No current user found.');
    }

    const inviteRef = doc(
      this.db,
      'users',
      currentUserData.uid,
      'receivedDoctorInvitations',
      invitationId
    );

    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      throw new Error('Invitation not found.');
    }

    const invitation: any = inviteSnap.data();
    const respondedAt = new Date();

    await updateDoc(inviteRef, {
      status: 'declined',
      respondedAt
    });

    await updateDoc(
      doc(this.db, 'users', invitation.fromUserId, 'sentDoctorInvitations', invitationId),
      {
        status: 'declined',
        respondedAt
      }
    );
  }

  async cancelDoctorInvitation(invitationId: string): Promise<void> {
    const currentUserData = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!currentUserData.uid) {
      throw new Error('No current user found.');
    }

    await this.cancelDoctorInvitationWithUser(invitationId, currentUserData.uid);
  }

  async cancelDoctorInvitationWithUser(
    invitationId: string,
    currentUserId: string
  ): Promise<void> {
    const sentInviteRef = doc(
      this.db,
      'users',
      currentUserId,
      'sentDoctorInvitations',
      invitationId
    );

    const inviteSnap = await getDoc(sentInviteRef);

    if (!inviteSnap.exists()) {
      throw new Error('Invitation not found.');
    }

    const invitation: any = inviteSnap.data();
    const respondedAt = new Date();

    await updateDoc(sentInviteRef, {
      status: 'cancelled',
      respondedAt
    });

    if (invitation.toUserId) {
      await updateDoc(
        doc(this.db, 'users', invitation.toUserId, 'receivedDoctorInvitations', invitationId),
        {
          status: 'cancelled',
          respondedAt
        }
      );
    }
  }

  async declineDoctorInvitationWithUser(
    invitationId: string,
    currentUserId: string
  ): Promise<void> {
    const inviteRef = doc(
      this.db,
      'users',
      currentUserId,
      'receivedDoctorInvitations',
      invitationId
    );

    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      throw new Error('Invitation not found.');
    }

    const invitation: any = inviteSnap.data();
    const respondedAt = new Date();

    await updateDoc(inviteRef, {
      status: 'declined',
      respondedAt
    });

    await updateDoc(
      doc(this.db, 'users', invitation.fromUserId, 'sentDoctorInvitations', invitationId),
      {
        status: 'declined',
        respondedAt
      }
    );
  }

  async deleteDoctor(doctorToDelete: any): Promise<void> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const currentUserId = currentUser.uid;

    const doctorUid =
      doctorToDelete.doctorUid ||
      doctorToDelete.connectedUserId ||
      doctorToDelete.id;

    if (!currentUserId || !doctorUid) {
      throw new Error('Missing user or doctor ID.');
    }

    await deleteDoc(doc(this.db, 'users', currentUserId, 'doctors', doctorUid));
    await deleteDoc(doc(this.db, 'users', doctorUid, 'doctors', currentUserId));
  }

  async getUserDoctors(userId: string): Promise<any[]> {
    const doctorsRef = collection(this.db, 'users', userId, 'doctors');

    const q = query(
      doctorsRef,
      where('status', '==', 'accepted')
    );

    const snap = await getDocs(q);

    return snap.docs
      .map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        isFromRelation: true
      }))
      .filter((doctor: any) => doctor.doctorUid !== userId);
  }

  async getConnectedDoctors(userId: string): Promise<any[]> {
    return this.getUserDoctors(userId);
  }

  async getReceivedInvitations(userId: string): Promise<DoctorInvitation[]> {
    const invitationsRef = collection(
      this.db,
      'users',
      userId,
      'receivedDoctorInvitations'
    );

    const q = query(
      invitationsRef,
      where('status', '==', 'pending')
    );

    const snap = await getDocs(q);

    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as DoctorInvitation[];
  }

  async getReceivedInvitationsByEmail(email: string): Promise<DoctorInvitation[]> {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    if (!currentUser.uid) {
      return [];
    }

    const invitations = await this.getReceivedInvitations(currentUser.uid);

    return invitations.filter(invite =>
      invite.toUserEmail?.toLowerCase() === email.toLowerCase()
    );
  }

  async getSentInvitations(userId: string): Promise<DoctorInvitation[]> {
    const invitationsRef = collection(
      this.db,
      'users',
      userId,
      'sentDoctorInvitations'
    );

    const snap = await getDocs(invitationsRef);

    return snap.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    })) as DoctorInvitation[];
  }

  listenForDoctorInvitations(userId: string): () => void {
    const invitationsRef = collection(
      this.db,
      'users',
      userId,
      'receivedDoctorInvitations'
    );

    const q = query(
      invitationsRef,
      where('status', '==', 'pending')
    );

    return onSnapshot(q, snapshot => {
      const invitations = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as DoctorInvitation[];

      this.pendingInvitationsSubject.next(invitations);
    });
  }

  listenForDoctorRelations(userId: string): () => void {
    const doctorsRef = collection(this.db, 'users', userId, 'doctors');

    const q = query(
      doctorsRef,
      where('status', '==', 'accepted')
    );

    return onSnapshot(q, snapshot => {
      const doctors = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      this.doctorRelationsSubject.next(doctors);
    });
  }

  async sendDoctorInvitationViaFunction(
    currentUser: any,
    targetEmail: string,
    message: string
  ): Promise<void> {
    const sendDoctorInvitation = httpsCallable(
      this.functions,
      'sendDoctorInvitationFunction'
    );

    await sendDoctorInvitation({
      currentUserUid: currentUser.uid,
      currentUserEmail: currentUser.email,
      currentUserName:
        currentUser.fullName ||
        `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
      targetEmail,
      message
    });
  }
}
