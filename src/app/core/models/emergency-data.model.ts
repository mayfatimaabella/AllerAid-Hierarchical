export interface EmergencyData {
  name?: string;
  allergies?: string;
  emergencyInstruction?: string;
  emergencyInstructions?: { allergyName: string; instruction: string }[];
  emergencyMessage?: {
    audioUrl?: string;
    instructions?: string;
  };
}