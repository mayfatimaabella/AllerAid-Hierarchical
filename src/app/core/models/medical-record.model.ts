import { EmergencyInstruction } from './emergency-instruction.model';

export interface MedicalRecord {
  id?: string;
  uid: string;
  emergencyInstruction: string;
  emergencyInstructions: EmergencyInstruction[];
  medications: any[];
  createdAt: Date;
  updatedAt: Date;
}