export interface Buddy {
  id: string;

  buddyUid: string;
  buddyEmail: string;
  buddyName: string;

  requesterUid: string;
  responderUid: string;

  relationship: string;
  status: 'accepted';

  invitationId: string;

  createdAt: Date;
  acceptedAt?: Date;

  isFromRelation?: boolean;
  connectedUserId?: string;
}