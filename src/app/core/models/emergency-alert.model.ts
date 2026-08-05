import { Timestamp } from 'firebase/firestore';
import { EmergencyLocation } from './emergency-location.model';
import { EmergencyStatus } from './emergency-status.model';
import { BuddyResponsePayload } from './buddy-response.model';

export interface EmergencyAlert {
  id?: string;

  // Patient info
  userId: string;
  userName: string;

  timestamp: Timestamp | Date;

  location: EmergencyLocation | null;

  responderLocation?: EmergencyLocation | null;

  // Emergency details
  allergies?: string[];
  instruction?: string;
  emergencyInstruction?: string;

  emergencyData?: {
    name?: string;
    allergies?: string;
    emergencyInstruction?: string;
    emergencyInstructions?: {
      allergyName: string;
      instruction: string;
    }[];
    emergencyMessage?: {
      audioUrl?: string;
      instructions?: string;
    };
  };

  alertType?:
    | 'shake'
    | 'volume-button'
    | 'manual'
    | 'buddy-request';

  status: EmergencyStatus;

  dismissed?: boolean;

  buddyIds: string[];

  notifiedBuddies?: string[];

  responderId?: string;
  responderName?: string;

  estimatedArrival?: number;
  distance?: number;

  displayAddress?: string;

  buddyResponses?: Record<string, BuddyResponsePayload>;

  // Push notification status
  notificationStatus?: {
    [buddyId: string]:
    | 'sending'
    | 'pending'
    | 'sent'
    | 'delivered'
    | 'received_in_app'
  };

  notificationDeliveredAt?: Record<string, Timestamp>;

  responseTimestamp?: Timestamp;

  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolvedByName?: string;
  patientCondition?: string;
}