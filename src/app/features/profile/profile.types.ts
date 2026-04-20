export interface Allergy {
  name: string;
  label?: string;
  checked?: boolean;
  value?: string;
}

export interface AllergyOption {
  name: string;
  checked: boolean;
  hasInput?: boolean;
  value?: string;
}

export interface DoctorStats {
  activePatients: number;
  pendingRequests: number;
  recentConsultations: number;
  criticalPatients?: number;
  highRiskPatients?: number;
  upcomingAppointments?: number;
}

export interface Activity {
  type: string;
  description: string;
  timestamp: Date | string;
}

export interface ProfessionalSettings {
  accessRequestNotifications: boolean;
  patientUpdateNotifications: boolean;
  emergencyAlerts: boolean;
  workingHours?: string;
  contactPreference?: string;
}

export interface ProfessionalCredential {
  name: string;
  issuer: string;
  dateIssued: Date | string;
}

export interface EmergencyMessageFormData {
  name?: string;
  allergies?: string;
  instructions?: string;
  location?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  dateOfBirth?: string;
  bloodType?: string;
  avatar?: string;
}

export interface EmergencyInstructionItem {
  allergyId?: string;
  allergyName?: string;
  instruction?: string;
}

export type ActiveModal = 'examples' | 'emergencyMessage' | 'emergencyInfo' | null;