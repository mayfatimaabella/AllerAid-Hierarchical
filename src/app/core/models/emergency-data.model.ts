import { EmergencyInstruction } from './emergency-instruction.model';

export interface EmergencyData {
  name?: string;
  allergies?: string;
  emergencyInstruction?: string;
  emergencyInstructions?: { allergyName: string; instruction: string }[];
  generalEmergencyInstruction?: string;
  allergyEmergencyInstructions?: EmergencyInstruction[];
  emergencyMessage?: {
    audioUrl?: string;
    instructions?: string;
  };
}