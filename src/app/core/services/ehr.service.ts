import { Injectable } from '@angular/core';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import { AuthService } from './auth.service';

export interface MedicalHistory {
  id?: string;
  patientId: string;
  condition: string;
  diagnosisDate: string;
  status: 'active' | 'resolved' | 'chronic' | 'not-cured';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AllergicReaction {
  id?: string;
  patientId: string;
  allergen: string;
  reactionDate: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  symptoms: string[];
  treatment: string;
  outcome: 'resolved' | 'ongoing' | 'hospitalized';
  treatmentEffectiveness: 'very-effective' | 'effective' | 'partially-effective' | 'ineffective';
  doctorId?: string;
  doctorName?: string;
  location?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TreatmentOutcome {
  id?: string;
  patientId: string;
  doctorVisitId?: string;
  treatmentType: string;
  medicationsPrescribed: string[];
  patientResponse: 'excellent' | 'good' | 'fair' | 'poor';
  sideEffects?: string[];
  followUpRequired: boolean;
  followUpDate?: string;
  doctorNotes: string;
  patientFeedback?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DoctorPatient {
  patientId: string;
  patientName: string;
  patientEmail: string;
  dateOfBirth: string;
  primaryAllergies: string[];
  lastVisit?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  totalVisits: number;
  accessGrantedDate: Date;
}

export interface DoctorVisit {
  id?: string;
  patientId: string;
  doctorName: string;
  doctorEmail?: string; // Added for better matching and access control
  specialty?: string;
  visitDate: string;
  chiefComplaint: string;
  diagnosis?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface HealthcareProvider {
  email: string;
  role: 'doctor' | 'nurse';
  name: string;
  license?: string;
  specialty?: string;
  hospital?: string;
  grantedAt: Date;
  grantedBy: string; // Patient ID who granted access
}

export interface AccessRequest {
  id?: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  doctorEmail: string;
  doctorName: string;
  doctorRole: 'doctor' | 'nurse';
  specialty?: string;
  originalVisitName: string; // Name as entered in the visit
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  requestDate: Date;
  responseDate?: Date;
  expiryDate: Date; // Auto-expire after 30 days
  message?: string; // Optional message from patient
  notes?: string; // Doctor's notes when responding
}

export interface EHRRecord {
  id?: string;
  patientId: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    bloodType?: string;
    phoneNumber: string;
    email: string;
    address: string;
  };
  allergies: any[];
  medications: any[];
  medicalHistory: MedicalHistory[];
  doctorVisits: DoctorVisit[];
  accessibleBy: string[]; // Legacy: User IDs who can access this EHR
  healthcareProviders: HealthcareProvider[]; // Enhanced: Healthcare providers with roles
  lastUpdated?: Date;
  createdAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class EHRService {
  private db: any;

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.db = this.firebaseService.getDb();
  }

  /**
   * Create or update EHR record
   */
  async createOrUpdateEHR(ehrData: Partial<EHRRecord>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const ehrRef = doc(this.db, `ehr/${currentUser.uid}`);
      const existingEHR = await getDoc(ehrRef);

      const updatedData = {
        ...ehrData,
        patientId: currentUser.uid,
        lastUpdated: new Date()
      };

      if (existingEHR.exists()) {
        await updateDoc(ehrRef, updatedData);
      } else {
        await addDoc(collection(this.db, 'ehr'), {
          ...updatedData,
          createdAt: new Date()
        });
      }

      console.log('EHR record updated successfully');
    } catch (error) {
      console.error('Error updating EHR record:', error);
      throw error;
    }
  }

  /**
   * Get EHR record for current user
   */
  async getEHRRecord(): Promise<EHRRecord | null> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const ehrQuery = query(
        collection(this.db, 'ehr'),
        where('patientId', '==', currentUser.uid)
      );
      const ehrSnapshot = await getDocs(ehrQuery);

      if (!ehrSnapshot.empty) {
        const ehrDoc = ehrSnapshot.docs[0];
        return {
          id: ehrDoc.id,
          ...ehrDoc.data()
        } as EHRRecord;
      }

      return null;
    } catch (error) {
      console.error('Error fetching EHR record:', error);
      throw error;
    }
  }

  /**
   * Add medical history entry
   */
  async addMedicalHistory(historyData: Omit<MedicalHistory, 'id' | 'patientId'>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      await addDoc(collection(this.db, `ehr/${currentUser.uid}/medicalHistory`), {
        ...historyData,
        patientId: currentUser.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error adding medical history:', error);
      throw error;
    }
  }

  /**
   * Get medical history
   */
  async getMedicalHistory(): Promise<MedicalHistory[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const historyQuery = query(
        collection(this.db, `ehr/${currentUser.uid}/medicalHistory`),
        orderBy('diagnosisDate', 'desc')
      );
      const historySnapshot = await getDocs(historyQuery);

      return historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MedicalHistory[];
    } catch (error) {
      console.error('Error fetching medical history:', error);
      throw error;
    }
  }

  /**
   * Get a single medical history record by ID
   */
  async getMedicalHistoryById(recordId: string): Promise<MedicalHistory | null> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const docRef = doc(this.db, `ehr/${currentUser.uid}/medicalHistory`, recordId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as MedicalHistory;
      } else {
        console.warn('Medical history record not found:', recordId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching medical history by ID:', error);
      throw error;
    }
  }

  /**
   * Update medical history entry
   */
  async updateMedicalHistory(historyId: string, historyData: Omit<MedicalHistory, 'id' | 'patientId'>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const historyRef = doc(this.db, `ehr/${currentUser.uid}/medicalHistory`, historyId);
      await updateDoc(historyRef, {
        ...historyData,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating medical history:', error);
      throw error;
    }
  }

  /**
   * Delete medical history entry
   */
  async deleteMedicalHistory(historyId: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const historyRef = doc(this.db, `ehr/${currentUser.uid}/medicalHistory`, historyId);
      await deleteDoc(historyRef);
    } catch (error) {
      console.error('Error deleting medical history:', error);
      throw error;
    }
  }

  /**
   * Add doctor visit
   */
  async addDoctorVisit(visitData: Omit<DoctorVisit, 'id' | 'patientId'>): Promise<void> {
    console.log('EHR Service: Starting addDoctorVisit with data:', visitData);
    
    const currentUser = await this.authService.waitForAuthInit();
    console.log('EHR Service: Current user:', currentUser?.uid);
    
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      // Clean and validate simplified data before saving
      const cleanedData: Partial<DoctorVisit> & { patientId: string; createdAt: Date; updatedAt: Date } = {
        doctorName: visitData.doctorName?.trim() || '',
        doctorEmail: visitData.doctorEmail?.trim() || '',
        specialty: visitData.specialty?.trim() || '',
        visitDate: visitData.visitDate || new Date().toISOString(),
        chiefComplaint: visitData.chiefComplaint?.trim() || '',
        diagnosis: visitData.diagnosis?.trim() || '',
        notes: visitData.notes?.trim() || '',
        patientId: currentUser.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('EHR Service: Cleaned document data to save:', cleanedData);
      
      const docRef = await addDoc(collection(this.db, `ehr/${currentUser.uid}/doctorVisits`), cleanedData);
      console.log('EHR Service: Doctor visit added successfully with ID:', docRef.id);
      
      // Auto-grant access to doctor if they have an email (registered in system)
      if (cleanedData.doctorEmail) {
        await this.autoGrantDoctorAccessByEmail(cleanedData.doctorEmail!, cleanedData.doctorName!, cleanedData.specialty);
      } else {
        // Fallback to name-based matching for manually entered doctors
        await this.autoGrantDoctorAccess(cleanedData.doctorName!, cleanedData.specialty);
      }
      
    } catch (error) {
      console.error('EHR Service: Detailed error adding doctor visit:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }

  /**
   * Get doctor visits
   */
  async getDoctorVisits(): Promise<DoctorVisit[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const visitsQuery = query(
        collection(this.db, `ehr/${currentUser.uid}/doctorVisits`),
        orderBy('visitDate', 'desc')
      );
      const visitsSnapshot = await getDocs(visitsQuery);

      return visitsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DoctorVisit[];
    } catch (error) {
      console.error('Error fetching doctor visits:', error);
      throw error;
    }
  }

  /**
   * Get a single doctor visit by ID
   */
  async getDoctorVisitById(visitId: string): Promise<DoctorVisit | null> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const docRef = doc(this.db, `ehr/${currentUser.uid}/doctorVisits`, visitId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as DoctorVisit;
      } else {
        console.warn('Doctor visit not found:', visitId);
        return null;
      }
    } catch (error) {
      console.error('Error fetching doctor visit by ID:', error);
      throw error;
    }
  }

  /**
   * Update doctor visit
   */
  async updateDoctorVisit(visitId: string, visitData: Partial<DoctorVisit>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const visitRef = doc(this.db, `ehr/${currentUser.uid}/doctorVisits/${visitId}`);
      const cleanedUpdate: any = {
        updatedAt: new Date()
      };
      if (visitData.doctorName !== undefined) cleanedUpdate.doctorName = visitData.doctorName?.trim() || '';
      if (visitData.doctorEmail !== undefined) cleanedUpdate.doctorEmail = visitData.doctorEmail?.trim() || '';
      if (visitData.specialty !== undefined) cleanedUpdate.specialty = visitData.specialty?.trim() || '';
      if (visitData.visitDate !== undefined) cleanedUpdate.visitDate = visitData.visitDate;
      if (visitData.chiefComplaint !== undefined) cleanedUpdate.chiefComplaint = visitData.chiefComplaint?.trim() || '';
      if (visitData.diagnosis !== undefined) cleanedUpdate.diagnosis = visitData.diagnosis?.trim() || '';
      if (visitData.notes !== undefined) cleanedUpdate.notes = visitData.notes?.trim() || '';
      await updateDoc(visitRef, cleanedUpdate);
    } catch (error) {
      console.error('Error updating doctor visit:', error);
      throw error;
    }
  }

  /**
   * Delete doctor visit
   */
  async deleteDoctorVisit(visitId: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const visitRef = doc(this.db, `ehr/${currentUser.uid}/doctorVisits/${visitId}`);
      await deleteDoc(visitRef);
    } catch (error) {
      console.error('Error deleting doctor visit:', error);
      throw error;
    }
  }

  /**
   * Grant access to EHR for healthcare provider with role
   * Now includes validation to ensure provider exists in system
   */
  async grantHealthcareProviderAccess(
    providerEmail: string, 
    role: 'doctor' | 'nurse',
    providerName: string,
    license?: string,
    specialty?: string,
    hospital?: string
  ): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      // First, verify that the provider exists in the system with the correct role
      const usersRef = collection(this.db, 'users');
      const providerQuery = query(
        usersRef,
        where('email', '==', providerEmail.toLowerCase()),
        where('role', 'in', ['doctor', 'nurse'])
      );
      
      const providerSnapshot = await getDocs(providerQuery);
      
      if (providerSnapshot.empty) {
        throw new Error('Healthcare provider not found in system. Provider must be registered as a doctor or nurse.');
      }
      
      const providerData = providerSnapshot.docs[0].data();
      
      // Verify the role matches what's in the system
      if (providerData['role'] !== role) {
        throw new Error(`Provider is registered as ${providerData['role']}, not ${role}`);
      }

      // Create access request instead of immediately granting access
      await this.createAccessRequest(
        providerEmail,
        role,
        providerName || `${providerData['firstName']} ${providerData['lastName']}`,
        specialty || providerData['specialty'] || '',
        providerName // Original name as entered
      );
      
      console.log('Access request created for verified healthcare provider:', providerEmail);

    } catch (error) {
      console.error('Error granting healthcare provider access:', error);
      throw error;
    }
  }

  /**
   * Revoke access from healthcare provider
   */
  async revokeHealthcareProviderAccess(providerEmail: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const ehrRecord = await this.getEHRRecord();
      if (ehrRecord && ehrRecord.healthcareProviders) {
        const updatedProviders = ehrRecord.healthcareProviders.filter(
          provider => provider.email !== providerEmail
        );
        
        await this.createOrUpdateEHR({
          healthcareProviders: updatedProviders
        });
      }
    } catch (error) {
      console.error('Error revoking healthcare provider access:', error);
      throw error;
    }
  }

  /**
   * Get healthcare providers with access
   */
  async getHealthcareProviders(): Promise<HealthcareProvider[]> {
    const ehrRecord = await this.getEHRRecord();
    return ehrRecord?.healthcareProviders || [];
  }

  /**
   * Check if a healthcare provider has specific permission
   */
  hasPermission(provider: HealthcareProvider, permission: string): boolean {
    const permissions = {
      doctor: {
        viewFullEHR: true,
        viewMedicalHistory: true,
        viewMedications: true,
        viewAllergies: true,
        addDoctorVisit: true,
        editDoctorVisit: true,
        deleteDoctorVisit: true,
        prescribeMedications: true,
        editMedicalHistory: true
      },
      nurse: {
        viewFullEHR: true,
        viewMedicalHistory: true,
        viewMedications: true,
        viewAllergies: true,
        addDoctorVisit: false,
        editDoctorVisit: false,  
        deleteDoctorVisit: false,
        prescribeMedications: false,
        editMedicalHistory: false
      }
    };

    return permissions[provider.role]?.[permission as keyof typeof permissions.doctor] || false;
  }

  /**
   * Grant access to EHR for healthcare provider (legacy method - maintained for compatibility)
   */
  async grantEHRAccess(providerEmail: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const ehrRecord = await this.getEHRRecord();
      if (ehrRecord) {
        const currentAccess = ehrRecord.accessibleBy || [];
        if (!currentAccess.includes(providerEmail)) {
          currentAccess.push(providerEmail);
          await this.createOrUpdateEHR({
            accessibleBy: currentAccess
          });
        }
      }
    } catch (error) {
      console.error('Error granting EHR access:', error);
      throw error;
    }
  }

  /**
   * Revoke access to EHR
   */
  async revokeEHRAccess(providerEmail: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const ehrRecord = await this.getEHRRecord();
      if (ehrRecord) {
        const currentAccess = ehrRecord.accessibleBy || [];
        const updatedAccess = currentAccess.filter(email => email !== providerEmail);
        await this.createOrUpdateEHR({
          accessibleBy: updatedAccess
        });
      }
    } catch (error) {
      console.error('Error revoking EHR access:', error);
      throw error;
    }
  }

  // ============= PROFESSIONAL WORKFLOW FEATURES =============

  /**
   * Add allergic reaction record - for tracking patient reactions
   */
  async addAllergicReaction(reactionData: Omit<AllergicReaction, 'id' | 'patientId'>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      await addDoc(collection(this.db, `ehr/${currentUser.uid}/allergicReactions`), {
        ...reactionData,
        patientId: currentUser.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error adding allergic reaction:', error);
      throw error;
    }
  }

  /**
   * Get allergic reactions for analysis
   */
  async getAllergicReactions(): Promise<AllergicReaction[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const reactionsQuery = query(
        collection(this.db, `ehr/${currentUser.uid}/allergicReactions`),
        orderBy('reactionDate', 'desc')
      );
      const reactionsSnapshot = await getDocs(reactionsQuery);

      return reactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AllergicReaction[];
    } catch (error) {
      console.error('Error fetching allergic reactions:', error);
      throw error;
    }
  }

  /**
   * Add treatment outcome for tracking effectiveness
   */
  async addTreatmentOutcome(outcomeData: Omit<TreatmentOutcome, 'id' | 'patientId'>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      await addDoc(collection(this.db, `ehr/${currentUser.uid}/treatmentOutcomes`), {
        ...outcomeData,
        patientId: currentUser.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error adding treatment outcome:', error);
      throw error;
    }
  }

  /**
   * Get treatment outcomes for analysis
   */
  async getTreatmentOutcomes(): Promise<TreatmentOutcome[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) {
      throw new Error('User not logged in');
    }

    try {
      const outcomesQuery = query(
        collection(this.db, `ehr/${currentUser.uid}/treatmentOutcomes`),
        orderBy('createdAt', 'desc')
      );
      const outcomesSnapshot = await getDocs(outcomesQuery);

      return outcomesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TreatmentOutcome[];
    } catch (error) {
      console.error('Error fetching treatment outcomes:', error);
      throw error;
    }
  }

  /**
   * Get patient list for doctor dashboard - Professional Workflow Feature
   */
  async getDoctorPatients(doctorEmail: string): Promise<DoctorPatient[]> {
    try {
      // Query all EHR records where doctor has access
      const ehrQuery = query(
        collection(this.db, 'ehr'),
        where('healthcareProviders', 'array-contains', { email: doctorEmail, role: 'doctor' })
      );
      const ehrSnapshot = await getDocs(ehrQuery);

      const patients: DoctorPatient[] = [];

      for (const ehrDoc of ehrSnapshot.docs) {
        const ehrData = ehrDoc.data() as EHRRecord;
        
        // Get patient's recent visits
        const visitsQuery = query(
          collection(this.db, `ehr/${ehrData.patientId}/doctorVisits`),
          orderBy('visitDate', 'desc')
        );
        const visitsSnapshot = await getDocs(visitsQuery);
        const visits = visitsSnapshot.docs.map(doc => doc.data()) as DoctorVisit[];

        // Get patient's allergic reactions
        const reactionsQuery = query(
          collection(this.db, `ehr/${ehrData.patientId}/allergicReactions`),
          orderBy('reactionDate', 'desc')
        );
        const reactionsSnapshot = await getDocs(reactionsQuery);
        const reactions = reactionsSnapshot.docs.map(doc => doc.data()) as AllergicReaction[];

        // Calculate risk level based on allergies and recent reactions
        const riskLevel = this.calculatePatientRiskLevel(ehrData.allergies, reactions);

        // Find provider access date
        const provider = ehrData.healthcareProviders?.find(p => p.email === doctorEmail);

        patients.push({
          patientId: ehrData.patientId,
          patientName: `${ehrData.personalInfo?.firstName || ''} ${ehrData.personalInfo?.lastName || ''}`.trim(),
          patientEmail: ehrData.personalInfo?.email || '',
          dateOfBirth: ehrData.personalInfo?.dateOfBirth || '',
          primaryAllergies: ehrData.allergies?.map(a => a.label || a.name).slice(0, 3) || [],
          lastVisit: visits[0]?.visitDate || undefined,
          // nextAppointment removed from simplified DoctorVisit model
          riskLevel: riskLevel,
          totalVisits: visits.length,
          accessGrantedDate: provider?.grantedAt || new Date()
        });
      }

      return patients.sort((a, b) => {
        // Sort by risk level first, then by last visit
        const riskOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
        if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        }
        return new Date(b.lastVisit || 0).getTime() - new Date(a.lastVisit || 0).getTime();
      });

    } catch (error) {
      console.error('Error fetching doctor patients:', error);
      throw error;
    }
  }

  /**
   * Calculate patient risk level based on allergies and reactions
   */
  private calculatePatientRiskLevel(allergies: any[], reactions: AllergicReaction[]): 'low' | 'medium' | 'high' | 'critical' {
    // Check for recent severe reactions
    const recentSevereReactions = reactions.filter(r => {
      const reactionDate = new Date(r.reactionDate);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return reactionDate > sixMonthsAgo && (r.severity === 'severe' || r.severity === 'life-threatening');
    });

    if (recentSevereReactions.length > 0) {
      return 'critical';
    }

    // Check for high-risk allergies
    const highRiskAllergens = ['peanuts', 'shellfish', 'insectStings', 'medication'];
    const hasHighRiskAllergies = allergies.some(a => 
      highRiskAllergens.includes(a.name) && a.checked
    );

    // Check for multiple allergies
    const allergyCount = allergies.filter(a => a.checked).length;

    if (hasHighRiskAllergies && allergyCount >= 3) {
      return 'high';
    } else if (hasHighRiskAllergies || allergyCount >= 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get comprehensive patient analysis for doctors
   */
  async getPatientAnalysis(patientId: string): Promise<{
    personalInfo: any;
    allergies: any[];
    recentReactions: AllergicReaction[];
    treatmentHistory: TreatmentOutcome[];
    visitHistory: DoctorVisit[];
    medicalHistory: MedicalHistory[];
    riskFactors: string[];
    recommendations: string[];
  }> {
    try {
      // Get patient's EHR record
      const ehrQuery = query(
        collection(this.db, 'ehr'),
        where('patientId', '==', patientId)
      );
      const ehrSnapshot = await getDocs(ehrQuery);

      if (ehrSnapshot.empty) {
        throw new Error('Patient not found');
      }

      const ehrData = ehrSnapshot.docs[0].data() as EHRRecord;

      // Get all patient data
      const [reactions, outcomes, visits, medicalHistory] = await Promise.all([
        this.getAllergicReactionsForPatient(patientId),
        this.getTreatmentOutcomesForPatient(patientId),
        this.getDoctorVisitsForPatient(patientId),
        this.getMedicalHistoryForPatient(patientId)
      ]);

      // Generate risk factors and recommendations
      const riskFactors = this.generateRiskFactors(ehrData, reactions, outcomes);
      const recommendations = this.generateRecommendations(ehrData, reactions, outcomes, visits);

      return {
        personalInfo: ehrData.personalInfo,
        allergies: ehrData.allergies || [],
        recentReactions: reactions.slice(0, 5), // Last 5 reactions
        treatmentHistory: outcomes.slice(0, 10), // Last 10 treatments
        visitHistory: visits.slice(0, 10), // Last 10 visits
        medicalHistory: medicalHistory,
        riskFactors,
        recommendations
      };

    } catch (error) {
      console.error('Error getting patient analysis:', error);
      throw error;
    }
  }

  /**
   * Helper methods for patient data retrieval
   */
  private async getAllergicReactionsForPatient(patientId: string): Promise<AllergicReaction[]> {
    const reactionsQuery = query(
      collection(this.db, `ehr/${patientId}/allergicReactions`),
      orderBy('reactionDate', 'desc')
    );
    const reactionsSnapshot = await getDocs(reactionsQuery);
    return reactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AllergicReaction[];
  }

  private async getTreatmentOutcomesForPatient(patientId: string): Promise<TreatmentOutcome[]> {
    const outcomesQuery = query(
      collection(this.db, `ehr/${patientId}/treatmentOutcomes`),
      orderBy('createdAt', 'desc')
    );
    const outcomesSnapshot = await getDocs(outcomesQuery);
    return outcomesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as TreatmentOutcome[];
  }

  private async getDoctorVisitsForPatient(patientId: string): Promise<DoctorVisit[]> {
    const visitsQuery = query(
      collection(this.db, `ehr/${patientId}/doctorVisits`),
      orderBy('visitDate', 'desc')
    );
    const visitsSnapshot = await getDocs(visitsQuery);
    return visitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as DoctorVisit[];
  }

  private async getMedicalHistoryForPatient(patientId: string): Promise<MedicalHistory[]> {
    const historyQuery = query(
      collection(this.db, `ehr/${patientId}/medicalHistory`),
      orderBy('diagnosisDate', 'desc')
    );
    const historySnapshot = await getDocs(historyQuery);
    return historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MedicalHistory[];
  }

  /**
   * Generate risk factors based on patient data
   */
  private generateRiskFactors(ehrData: EHRRecord, reactions: AllergicReaction[], outcomes: TreatmentOutcome[]): string[] {
    const riskFactors: string[] = [];

    // Multiple severe allergies
    const severeAllergies = ehrData.allergies?.filter(a => a.checked && ['peanuts', 'shellfish', 'insectStings'].includes(a.name));
    if (severeAllergies && severeAllergies.length >= 2) {
      riskFactors.push('Multiple severe allergies');
    }

    // Recent severe reactions
    const recentSevereReactions = reactions.filter(r => {
      const reactionDate = new Date(r.reactionDate);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      return reactionDate > sixMonthsAgo && (r.severity === 'severe' || r.severity === 'life-threatening');
    });

    if (recentSevereReactions.length > 0) {
      riskFactors.push(`${recentSevereReactions.length} severe reaction(s) in last 6 months`);
    }

    // Poor treatment responses
    const poorResponses = outcomes.filter(o => o.patientResponse === 'poor' || o.patientResponse === 'fair');
    if (poorResponses.length >= 2) {
      riskFactors.push('History of poor treatment responses');
    }

    // Chronic conditions
    const chronicConditions = ehrData.medicalHistory?.filter(h => h.status === 'chronic');
    if (chronicConditions && chronicConditions.length > 0) {
      riskFactors.push(`${chronicConditions.length} chronic condition(s)`);
    }

    return riskFactors;
  }

  /**
   * Generate recommendations based on patient data
   */
  private generateRecommendations(
    ehrData: EHRRecord, 
    reactions: AllergicReaction[], 
    outcomes: TreatmentOutcome[], 
    visits: DoctorVisit[]
  ): string[] {
    const recommendations: string[] = [];

    // EpiPen recommendation for severe allergies
    const severeAllergies = ehrData.allergies?.filter(a => a.checked && ['peanuts', 'shellfish', 'insectStings'].includes(a.name));
    if (severeAllergies && severeAllergies.length > 0) {
      recommendations.push('Ensure patient carries EpiPen at all times');
      recommendations.push('Consider allergy bracelet/medical alert jewelry');
    }

    // Follow-up based on recent reactions
    const recentReactions = reactions.filter(r => {
      const reactionDate = new Date(r.reactionDate);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      return reactionDate > oneMonthAgo;
    });

    if (recentReactions.length > 0) {
      recommendations.push('Schedule follow-up within 2 weeks');
      recommendations.push('Review trigger avoidance strategies');
    }

    // Regular monitoring for multiple allergies
    const activeAllergies = ehrData.allergies?.filter(a => a.checked);
    if (activeAllergies && activeAllergies.length >= 3) {
      recommendations.push('Regular allergy specialist consultation recommended');
    }

    // Medication review if poor outcomes
    const recentPoorOutcomes = outcomes.filter(o => 
      o.patientResponse === 'poor' || o.patientResponse === 'fair'
    ).slice(0, 2);

    if (recentPoorOutcomes.length > 0) {
      recommendations.push('Review current medication effectiveness');
      recommendations.push('Consider alternative treatment options');
    }

    return recommendations;
  }

  /**
   * Create a pending access request instead of auto-granting access
   */
  /**
   * Auto-grant doctor access using email (more reliable than name matching)
   */
  private async autoGrantDoctorAccessByEmail(doctorEmail: string, doctorName: string, specialty?: string): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      // Verify that the email belongs to a registered doctor
      const usersRef = collection(this.db, 'users');
      const doctorQuery = query(
        usersRef, 
        where('email', '==', doctorEmail),
        where('role', 'in', ['doctor', 'nurse'])
      );
      
      const doctorSnapshot = await getDocs(doctorQuery);
      
      if (!doctorSnapshot.empty) {
        const doctorDoc = doctorSnapshot.docs[0];
        const doctorData = doctorDoc.data();
        
        console.log('EHR Service: Found registered doctor by email:', doctorEmail);
        
        // Create a pending access request
        await this.createAccessRequest(
          doctorEmail,
          doctorData['role'] || 'doctor',
          doctorName,
          specialty || doctorData['specialty'] || 'General Medicine',
          doctorName
        );
        
        console.log('EHR Service: Created access request for doctor:', doctorEmail);
      } else {
        console.log('EHR Service: No registered doctor found with email:', doctorEmail);
      }

    } catch (error) {
      console.error('Error creating doctor access request by email:', error);
      // Don't throw error - this is a background operation
    }
  }

  private async autoGrantDoctorAccess(doctorName: string, specialty?: string): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      // Search for doctors in the users collection that match the name
      const usersRef = collection(this.db, 'users');
      const doctorQuery = query(
        usersRef, 
        where('role', '==', 'doctor')
      );
      
      const doctorSnapshot = await getDocs(doctorQuery);
      const doctors = doctorSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as any[];

      // Try to match the doctor by name
      const matchedDoctor = doctors.find(doctor => {
        const fullName = `${doctor.firstName} ${doctor.lastName}`.toLowerCase();
        const doctorNameClean = doctorName.toLowerCase()
          .replace(/^dr\.?\s*/i, '') // Remove "Dr." prefix
          .replace(/^nurse\s*/i, ''); // Remove "Nurse" prefix
        
        return fullName.includes(doctorNameClean) || doctorNameClean.includes(fullName);
      });

      if (matchedDoctor) {
        console.log('EHR Service: Found matching doctor in system:', matchedDoctor.email);
        
        // Create a pending access request instead of auto-granting
        await this.createAccessRequest(
          matchedDoctor.email,
          'doctor',
          `${matchedDoctor.firstName} ${matchedDoctor.lastName}`,
          specialty || matchedDoctor.specialty || 'General Medicine',
          doctorName // Original name from visit
        );
        
        console.log('EHR Service: Created access request for doctor:', matchedDoctor.email);
      } else {
        console.log('EHR Service: No matching doctor found in system for:', doctorName);
      }

    } catch (error) {
      console.error('Error creating doctor access request:', error);
      // Don't throw error - this is a background operation
    }
  }

  /**
   * Create an access request for doctor-patient relationship
   */
  async createAccessRequest(
    doctorEmail: string,
    role: 'doctor' | 'nurse',
    doctorName: string,
    specialty: string,
    originalVisitName: string
  ): Promise<void> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return;

      // Get patient info
      const patientDoc = await getDoc(doc(this.db, `users/${currentUser.uid}`));
      const patientData = patientDoc.data();

      if (!patientData) return;

      // Check if request already exists
      const existingRequestQuery = query(
        collection(this.db, 'accessRequests'),
        where('patientId', '==', currentUser.uid),
        where('doctorEmail', '==', doctorEmail),
        where('status', '==', 'pending')
      );
      
      const existingRequests = await getDocs(existingRequestQuery);
      if (!existingRequests.empty) {
        console.log('Access request already exists for this doctor');
        return;
      }

      // Create expiry date (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const accessRequest: Omit<AccessRequest, 'id'> = {
        patientId: currentUser.uid,
        patientName: `${patientData['firstName']} ${patientData['lastName']}`,
        patientEmail: patientData['email'],
        doctorEmail: doctorEmail,
        doctorName: doctorName,
        doctorRole: role,
        specialty: specialty,
        originalVisitName: originalVisitName,
        status: 'pending',
        requestDate: new Date(),
        expiryDate: expiryDate,
        message: `Patient ${patientData['firstName']} ${patientData['lastName']} has added you as their doctor in a visit record and would like to grant you access to their medical records.`
      };

      await addDoc(collection(this.db, 'accessRequests'), accessRequest);
      console.log('Access request created successfully');

    } catch (error) {
      console.error('Error creating access request:', error);
    }
  }

  /**
   * Get pending access requests for a doctor
   */
  async getPendingAccessRequests(): Promise<AccessRequest[]> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) {
        return [];
      }

      // Get current user's email
      const userDoc = await getDoc(doc(this.db, `users/${currentUser.uid}`));
      const userData = userDoc.data();
      
      if (!userData?.['email']) {
        return [];
      }

      const doctorEmail = userData['email'];

      const requestsQuery = query(
        collection(this.db, 'accessRequests'),
        where('doctorEmail', '==', doctorEmail),
        where('status', '==', 'pending'),
        orderBy('requestDate', 'desc')
      );

      const requestsSnapshot = await getDocs(requestsQuery);
      const requests = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AccessRequest[];

      // Filter out expired requests
      const now = new Date();
      return requests.filter(request => new Date(request.expiryDate) > now);

    } catch (error) {
      console.error('Error fetching access requests:', error);
      return [];
    }
  }

  /**
   * Respond to an access request (accept/decline)
   */
  async respondToAccessRequest(
    requestId: string, 
    response: 'accepted' | 'declined', 
    notes?: string
  ): Promise<void> {
    try {
      const requestRef = doc(this.db, `accessRequests/${requestId}`);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        throw new Error('Access request not found');
      }

      const requestData = requestDoc.data() as AccessRequest;

      // Update request status
      await updateDoc(requestRef, {
        status: response,
        responseDate: new Date(),
        notes: notes || ''
      });

      // If accepted, grant access to patient's EHR
      if (response === 'accepted') {
        // Get current user (doctor) info
        const currentUser = await this.authService.waitForAuthInit();
        if (!currentUser) throw new Error('User not logged in');

        const doctorDoc = await getDoc(doc(this.db, `users/${currentUser.uid}`));
        const doctorData = doctorDoc.data();

        if (doctorData) {
          // Use the patient's ID to grant access
          const patientEHRRef = doc(this.db, `ehr/${requestData.patientId}`);
          const patientEHR = await getDoc(patientEHRRef);

          if (patientEHR.exists()) {
            const ehrData = patientEHR.data() as EHRRecord;
            const healthcareProviders = ehrData.healthcareProviders || [];

            // Add doctor to healthcare providers
            const newProvider: HealthcareProvider = {
              email: requestData.doctorEmail,
              role: requestData.doctorRole,
              name: requestData.doctorName,
              license: doctorData['license'],
              specialty: requestData.specialty,
              hospital: doctorData['hospital'],
              grantedAt: new Date(),
              grantedBy: requestData.patientId
            };

            healthcareProviders.push(newProvider);

            await updateDoc(patientEHRRef, {
              healthcareProviders: healthcareProviders,
              lastUpdated: new Date()
            });

            console.log('Access granted successfully');
          }
        }
      }

    } catch (error) {
      console.error('Error responding to access request:', error);
      throw error;
    }
  }

  /**
   * Get access requests sent by current patient
   */
  async getMyAccessRequests(): Promise<AccessRequest[]> {
    try {
      const currentUser = await this.authService.waitForAuthInit();
      if (!currentUser) return [];

      const requestsQuery = query(
        collection(this.db, 'accessRequests'),
        where('patientId', '==', currentUser.uid),
        orderBy('requestDate', 'desc')
      );

      const requestsSnapshot = await getDocs(requestsQuery);
      return requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AccessRequest[];

    } catch (error) {
      console.error('Error fetching my access requests:', error);
      return [];
    }
  }
}

