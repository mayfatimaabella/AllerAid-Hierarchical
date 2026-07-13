import { Timestamp } from 'firebase/firestore';

export interface EmergencyAlert {
  id?: string;

  // Patient info
  userId: string;
  userName: string;

  timestamp: Timestamp | Date | any;

  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  } | null;

  responderLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };

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


  status:
    | 'active'
    | 'responding'
    | 'resolved'
    | 'cancelled';


  buddyIds: string[];

  notifiedBuddies?: string[];

  responderId?: string;
  responderName?: string;

  estimatedArrival?: number;
  distance?: number;
  displayAddress?: string;


  buddyResponses?: {
    [buddyId:string]: {
      status:
        | 'sent'
        | 'responded'
        | 'cannot_respond';

      timestamp:any;
      name?:string;
    }
  };


  // PUSH NOTIFICATION STATUS
  notificationStatus?: {
    [buddyId:string]:
      | 'sending'
      | 'pending'
      | 'sent'
      | 'delivered'
      | 'failed';
  };


  notificationDeliveredAt?: {
    [buddyId:string]: any;
  };


  responseTimestamp?: any;
}