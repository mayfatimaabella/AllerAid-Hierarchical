import { Timestamp } from 'firebase/firestore';

export type BuddyResponseStatus =
  | 'sent'
  | 'responded'
  | 'cannot_respond'
  | 'timed_out';

export interface BuddyResponsePayload {
  status: BuddyResponseStatus;
  timestamp: Timestamp;
  name?: string;
}

export interface BuddyResponse {
  status: BuddyResponseStatus;
  timestamp: Date;
  name: string;
}