import { EmergencyInstruction } from './emergency-instruction.model';
import { EmergencyMessage } from './emergency-message.model';

export interface MedicalRecord {
  id?: string;
  uid: string;
  emergencyInstruction: string;
  emergencyInstructions: EmergencyInstruction[];
  emergencyMessage: EmergencyMessage;
  medications: any[];
  createdAt: Date;
  updatedAt: Date;
}