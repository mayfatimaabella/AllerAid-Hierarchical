// Services
export { ProfileDetailService } from './profile-details.service';
export { UserService } from './user.service';
export { MedicalService } from './medical.profile.service';

// Models
export type { UserProfile } from './models/user-profile.model';
export type { ProfileDetails } from './models/profile-details.model';
export type { MedicalInfo } from './models/medical-info.model';
export type { AllergyInstruction } from './models/allergy-instruction.model';
export type { EmergencyProfile } from './models/emergency-profile.model';
export type { EmergencyLocation } from './models/emergency-location.model';
export type { EmergencySettings } from './models/emergency-settings.model';
export type { ProfessionalCredentials } from './models/professional-credentials.model';
export type { EmergencyInstruction } from './models/emergency-instruction.model';
export type { EmergencyMessage } from './models/emergency-message.model';
export type { MedicalRecord } from './models/medical-record.model';

export { AuthService } from './auth.service';

export { AllergyService } from './allergy.service';
export { BuddyService } from './buddy.service';
export { BarcodeService } from './barcode.service';

export { EmergencyService } from './emergency.service';
export { EmergencyAlertService } from './emergency-alert.service';
export { EmergencyDetectorService } from './emergency-detector.service';
export { EmergencyNotificationService } from './emergency-notification.service';
export {EmergencySettingsService,} from './emergency-settings.service';

export {
  VoiceRecordingService,
  VoiceRecording,
  AudioSettings
} from './voice-recording.service';


export {
  MedicationService,
  Medication
} from './medication.service';

export { ProductService } from './product.service';

export {
  EHRService,
  DoctorVisit,
  MedicalHistory,
  HealthcareProvider,
  AccessRequest,
  DoctorPatient,
  AllergicReaction,
  TreatmentOutcome
} from './ehr.service';

export { FirebaseService } from './firebase.service';
