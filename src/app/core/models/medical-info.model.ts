import { EmergencyInstruction } from './emergency-instruction.model';
import { Timestamp } from 'firebase/firestore';

export interface MedicalInfo {
  allergies: any[];

  allergyOnboardingCompleted: boolean;

  generalEmergencyInstruction?: string;

  allergyEmergencyInstructions?: EmergencyInstruction[];

  emergencyProfile?: EmergencyInstruction;

  emergencyMessage?: {
    instructions?: string;
  };

  buddySetupOnboarding?: {
    skippedBuddySetup?: boolean;
    fallbackUsed?: boolean;
    skippedAt?: Timestamp;
    updatedAt?: Timestamp;
  };

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}