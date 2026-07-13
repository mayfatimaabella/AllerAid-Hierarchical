
import { EmergencyInstruction } from './emergency-instruction.model';

export interface MedicalInfo {
  allergies: any[];

  allergyOnboardingCompleted: boolean;

  generalEmergencyInstruction?: string;

  allergyEmergencyInstructions?: EmergencyInstruction[];

  emergencyProfile?: EmergencyInstruction;

  buddySetupOnboarding?: {
    skippedBuddySetup?: boolean;
    fallbackUsed?: boolean;
    skippedAt?: any;
    updatedAt?: any;
  };

  createdAt?: any;
  updatedAt?: any;
}
