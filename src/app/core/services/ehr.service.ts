import { Injectable } from '@angular/core';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  query,
  orderBy,
  where,
  serverTimestamp
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
  createdAt?: any;
  updatedAt?: any;
}

export interface DoctorVisit {
  id?: string;
  patientId: string;
  doctorName: string;
  doctorEmail?: string;
  specialty?: string;
  visitDate: string;
  chiefComplaint: string;
  diagnosis?: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
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
  createdAt?: any;
  updatedAt?: any;
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
  createdAt?: any;
  updatedAt?: any;
}

export interface HealthcareProvider {
  email: string;
  role: 'doctor' | 'nurse';
  name: string;
  license?: string;
  specialty?: string;
  hospital?: string;
  grantedAt: any;
  grantedBy: string;
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
  originalVisitName: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  requestDate: any;
  responseDate?: any;
  expiryDate: any;
  message?: string;
  notes?: string;
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
  accessibleBy: string[];
  healthcareProviders: HealthcareProvider[];
  createdAt?: any;
  lastUpdated?: any;
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
  accessGrantedDate: any;
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

  private healthRecordsSummaryPath(uid: string): string {
    return `users/${uid}/healthRecords/summary`;
  }

  private healthRecordsCollectionPath(uid: string, collectionName: string): string {
    return `users/${uid}/healthRecords/${collectionName}`;
  }

  async createOrUpdateEHR(ehrData: Partial<EHRRecord>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const ehrRef = doc(this.db, this.healthRecordsSummaryPath(currentUser.uid));
    const existingEHR = await getDoc(ehrRef);

    const updatedData = {
      ...ehrData,
      patientId: currentUser.uid,
      lastUpdated: serverTimestamp()
    };

    if (existingEHR.exists()) {
      await updateDoc(ehrRef, updatedData);
    } else {
      await setDoc(ehrRef, {
        ...updatedData,
        createdAt: serverTimestamp()
      });
    }
  }

  async getEHRRecord(): Promise<EHRRecord | null> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const ehrRef = doc(this.db, this.healthRecordsSummaryPath(currentUser.uid));
    const ehrSnap = await getDoc(ehrRef);

    if (!ehrSnap.exists()) return null;

    return {
      id: ehrSnap.id,
      ...ehrSnap.data()
    } as EHRRecord;
  }

  async addMedicalHistory(historyData: Omit<MedicalHistory, 'id' | 'patientId'>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    await addDoc(collection(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'medicalHistory')), {
      ...historyData,
      patientId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async getMedicalHistory(): Promise<MedicalHistory[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const q = query(
      collection(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'medicalHistory')),
      orderBy('diagnosisDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MedicalHistory[];
  }

  async getMedicalHistoryById(recordId: string): Promise<MedicalHistory | null> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const ref = doc(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'medicalHistory'), recordId);
    const snap = await getDoc(ref);

    return snap.exists() ? ({ id: snap.id, ...snap.data() } as MedicalHistory) : null;
  }

  async updateMedicalHistory(historyId: string, historyData: Partial<MedicalHistory>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const ref = doc(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'medicalHistory'), historyId);
    await updateDoc(ref, {
      ...historyData,
      updatedAt: serverTimestamp()
    });
  }

  async deleteMedicalHistory(historyId: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const ref = doc(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'medicalHistory'), historyId);
    await deleteDoc(ref);
  }

  async addDoctorVisit(visitData: Omit<DoctorVisit, 'id' | 'patientId'>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const cleanedData = {
      doctorName: visitData.doctorName?.trim() || '',
      doctorEmail: visitData.doctorEmail?.trim().toLowerCase() || '',
      specialty: visitData.specialty?.trim() || '',
      visitDate: visitData.visitDate || new Date().toISOString(),
      chiefComplaint: visitData.chiefComplaint?.trim() || '',
      diagnosis: visitData.diagnosis?.trim() || '',
      notes: visitData.notes?.trim() || '',
      patientId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await addDoc(collection(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'doctorVisits')), cleanedData);

    if (cleanedData.doctorEmail) {
      await this.autoGrantDoctorAccessByEmail(
        cleanedData.doctorEmail,
        cleanedData.doctorName,
        cleanedData.specialty
      );
    } else {
      await this.autoGrantDoctorAccess(cleanedData.doctorName, cleanedData.specialty);
    }
  }

  async getDoctorVisits(): Promise<DoctorVisit[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const q = query(
      collection(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'doctorVisits')),
      orderBy('visitDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DoctorVisit[];
  }

  async getDoctorVisitById(visitId: string): Promise<DoctorVisit | null> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const ref = doc(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'doctorVisits'), visitId);
    const snap = await getDoc(ref);

    return snap.exists() ? ({ id: snap.id, ...snap.data() } as DoctorVisit) : null;
  }

  async updateDoctorVisit(visitId: string, visitData: Partial<DoctorVisit>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const ref = doc(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'doctorVisits'), visitId);

    const cleanedUpdate: any = {
      updatedAt: serverTimestamp()
    };

    if (visitData.doctorName !== undefined) cleanedUpdate.doctorName = visitData.doctorName?.trim() || '';
    if (visitData.doctorEmail !== undefined) cleanedUpdate.doctorEmail = visitData.doctorEmail?.trim().toLowerCase() || '';
    if (visitData.specialty !== undefined) cleanedUpdate.specialty = visitData.specialty?.trim() || '';
    if (visitData.visitDate !== undefined) cleanedUpdate.visitDate = visitData.visitDate;
    if (visitData.chiefComplaint !== undefined) cleanedUpdate.chiefComplaint = visitData.chiefComplaint?.trim() || '';
    if (visitData.diagnosis !== undefined) cleanedUpdate.diagnosis = visitData.diagnosis?.trim() || '';
    if (visitData.notes !== undefined) cleanedUpdate.notes = visitData.notes?.trim() || '';

    await updateDoc(ref, cleanedUpdate);
  }

  async deleteDoctorVisit(visitId: string): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const ref = doc(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'doctorVisits'), visitId);
    await deleteDoc(ref);
  }

  async addAllergicReaction(reactionData: Omit<AllergicReaction, 'id' | 'patientId'>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    await addDoc(collection(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'allergicReactions')), {
      ...reactionData,
      patientId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async getAllergicReactions(): Promise<AllergicReaction[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const q = query(
      collection(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'allergicReactions')),
      orderBy('reactionDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AllergicReaction[];
  }

  async addTreatmentOutcome(outcomeData: Omit<TreatmentOutcome, 'id' | 'patientId'>): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    await addDoc(collection(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'treatmentOutcomes')), {
      ...outcomeData,
      patientId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  async getTreatmentOutcomes(): Promise<TreatmentOutcome[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const q = query(
      collection(this.db, this.healthRecordsCollectionPath(currentUser.uid, 'treatmentOutcomes')),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TreatmentOutcome[];
  }

  async grantHealthcareProviderAccess(
    providerEmail: string,
    role: 'doctor' | 'nurse',
    providerName: string,
    license?: string,
    specialty?: string,
    hospital?: string
  ): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const providerQuery = query(
      collection(this.db, 'users'),
      where('email', '==', providerEmail.toLowerCase()),
      where('role', 'in', ['doctor', 'nurse'])
    );

    const providerSnapshot = await getDocs(providerQuery);

    if (providerSnapshot.empty) {
      throw new Error('Healthcare provider not found in system.');
    }

    const providerData = providerSnapshot.docs[0].data();

    if (providerData['role'] !== role) {
      throw new Error(`Provider is registered as ${providerData['role']}, not ${role}`);
    }

    await this.createAccessRequest(
      providerEmail.toLowerCase(),
      role,
      providerName || `${providerData['firstName']} ${providerData['lastName']}`,
      specialty || providerData['specialty'] || '',
      providerName
    );
  }

  async revokeHealthcareProviderAccess(providerEmail: string): Promise<void> {
    const ehrRecord = await this.getEHRRecord();

    if (!ehrRecord) return;

    const updatedProviders = (ehrRecord.healthcareProviders || []).filter(
      provider => provider.email !== providerEmail
    );

    await this.createOrUpdateEHR({
      healthcareProviders: updatedProviders
    });
  }

  async getHealthcareProviders(): Promise<HealthcareProvider[]> {
    const ehrRecord = await this.getEHRRecord();
    return ehrRecord?.healthcareProviders || [];
  }

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

  async grantEHRAccess(providerEmail: string): Promise<void> {
    const ehrRecord = await this.getEHRRecord();
    if (!ehrRecord) return;

    const currentAccess = ehrRecord.accessibleBy || [];

    if (!currentAccess.includes(providerEmail)) {
      currentAccess.push(providerEmail);
      await this.createOrUpdateEHR({
        accessibleBy: currentAccess
      });
    }
  }

  async revokeEHRAccess(providerEmail: string): Promise<void> {
    const ehrRecord = await this.getEHRRecord();
    if (!ehrRecord) return;

    const updatedAccess = (ehrRecord.accessibleBy || []).filter(email => email !== providerEmail);

    await this.createOrUpdateEHR({
      accessibleBy: updatedAccess
    });
  }

  async getDoctorPatients(doctorEmail: string): Promise<DoctorPatient[]> {
    const usersSnapshot = await getDocs(collection(this.db, 'users'));
    const patients: DoctorPatient[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const patientId = userDoc.id;
      const ehrRef = doc(this.db, this.healthRecordsSummaryPath(patientId));
      const ehrSnap = await getDoc(ehrRef);

      if (!ehrSnap.exists()) continue;

      const ehrData = ehrSnap.data() as EHRRecord;
      const provider = ehrData.healthcareProviders?.find(p => p.email === doctorEmail);

      if (!provider) continue;

      const visits = await this.getDoctorVisitsForPatient(patientId);
      const reactions = await this.getAllergicReactionsForPatient(patientId);
      const riskLevel = this.calculatePatientRiskLevel(ehrData.allergies || [], reactions);

      patients.push({
        patientId,
        patientName: `${ehrData.personalInfo?.firstName || ''} ${ehrData.personalInfo?.lastName || ''}`.trim(),
        patientEmail: ehrData.personalInfo?.email || '',
        dateOfBirth: ehrData.personalInfo?.dateOfBirth || '',
        primaryAllergies: ehrData.allergies?.map(a => a.label || a.name).slice(0, 3) || [],
        lastVisit: visits[0]?.visitDate || undefined,
        riskLevel,
        totalVisits: visits.length,
        accessGrantedDate: provider.grantedAt
      });
    }

    return patients.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
  }

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
    const ehrRef = doc(this.db, this.healthRecordsSummaryPath(patientId));
    const ehrSnap = await getDoc(ehrRef);

    if (!ehrSnap.exists()) {
      throw new Error('Patient EHR not found');
    }

    const ehrData = ehrSnap.data() as EHRRecord;

    const [reactions, outcomes, visits, medicalHistory] = await Promise.all([
      this.getAllergicReactionsForPatient(patientId),
      this.getTreatmentOutcomesForPatient(patientId),
      this.getDoctorVisitsForPatient(patientId),
      this.getMedicalHistoryForPatient(patientId)
    ]);

    return {
      personalInfo: ehrData.personalInfo,
      allergies: ehrData.allergies || [],
      recentReactions: reactions.slice(0, 5),
      treatmentHistory: outcomes.slice(0, 10),
      visitHistory: visits.slice(0, 10),
      medicalHistory,
      riskFactors: this.generateRiskFactors(ehrData, reactions, outcomes),
      recommendations: this.generateRecommendations(ehrData, reactions, outcomes, visits)
    };
  }

  private async getAllergicReactionsForPatient(patientId: string): Promise<AllergicReaction[]> {
    const q = query(
      collection(this.db, this.healthRecordsCollectionPath(patientId, 'allergicReactions')),
      orderBy('reactionDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AllergicReaction[];
  }

  private async getTreatmentOutcomesForPatient(patientId: string): Promise<TreatmentOutcome[]> {
    const q = query(
      collection(this.db, this.healthRecordsCollectionPath(patientId, 'treatmentOutcomes')),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TreatmentOutcome[];
  }

  private async getDoctorVisitsForPatient(patientId: string): Promise<DoctorVisit[]> {
    const q = query(
      collection(this.db, this.healthRecordsCollectionPath(patientId, 'doctorVisits')),
      orderBy('visitDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DoctorVisit[];
  }

  private async getMedicalHistoryForPatient(patientId: string): Promise<MedicalHistory[]> {
    const q = query(
      collection(this.db, this.healthRecordsCollectionPath(patientId, 'medicalHistory')),
      orderBy('diagnosisDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as MedicalHistory[];
  }

  private async autoGrantDoctorAccessByEmail(
    doctorEmail: string,
    doctorName: string,
    specialty?: string
  ): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) return;

    const doctorQuery = query(
      collection(this.db, 'users'),
      where('email', '==', doctorEmail.toLowerCase()),
      where('role', 'in', ['doctor', 'nurse'])
    );

    const snapshot = await getDocs(doctorQuery);
    if (snapshot.empty) return;

    const doctorData = snapshot.docs[0].data();

    await this.createAccessRequest(
      doctorEmail.toLowerCase(),
      doctorData['role'] || 'doctor',
      doctorName,
      specialty || doctorData['specialty'] || 'General Medicine',
      doctorName
    );
  }

  private async autoGrantDoctorAccess(doctorName: string, specialty?: string): Promise<void> {
    const doctorQuery = query(collection(this.db, 'users'), where('role', '==', 'doctor'));
    const snapshot = await getDocs(doctorQuery);

    const doctors = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    const matchedDoctor = doctors.find(doctor => {
      const fullName = `${doctor.firstName} ${doctor.lastName}`.toLowerCase();
      const cleanName = doctorName.toLowerCase().replace(/^dr\.?\s*/i, '').replace(/^nurse\s*/i, '');
      return fullName.includes(cleanName) || cleanName.includes(fullName);
    });

    if (!matchedDoctor) return;

    await this.createAccessRequest(
      matchedDoctor.email,
      'doctor',
      `${matchedDoctor.firstName} ${matchedDoctor.lastName}`,
      specialty || matchedDoctor.specialty || 'General Medicine',
      doctorName
    );
  }

  async createAccessRequest(
    doctorEmail: string,
    role: 'doctor' | 'nurse',
    doctorName: string,
    specialty: string,
    originalVisitName: string
  ): Promise<void> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) return;

    const patientDoc = await getDoc(doc(this.db, `users/${currentUser.uid}`));
    const patientData = patientDoc.data();

    if (!patientData) return;

    const existingQuery = query(
      collection(this.db, 'accessRequests'),
      where('patientId', '==', currentUser.uid),
      where('doctorEmail', '==', doctorEmail),
      where('status', '==', 'pending')
    );

    const existingRequests = await getDocs(existingQuery);
    if (!existingRequests.empty) return;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);

    const accessRequest: Omit<AccessRequest, 'id'> = {
      patientId: currentUser.uid,
      patientName: `${patientData['firstName']} ${patientData['lastName']}`,
      patientEmail: patientData['email'],
      doctorEmail,
      doctorName,
      doctorRole: role,
      specialty,
      originalVisitName,
      status: 'pending',
      requestDate: serverTimestamp(),
      expiryDate,
      message: `Patient ${patientData['firstName']} ${patientData['lastName']} would like to grant you access to their medical records.`
    };

    await addDoc(collection(this.db, 'accessRequests'), accessRequest);
  }

  async getPendingAccessRequests(): Promise<AccessRequest[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) return [];

    const userDoc = await getDoc(doc(this.db, `users/${currentUser.uid}`));
    const userData = userDoc.data();

    if (!userData?.['email']) return [];

    const q = query(
      collection(this.db, 'accessRequests'),
      where('doctorEmail', '==', userData['email']),
      where('status', '==', 'pending'),
      orderBy('requestDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AccessRequest[];
  }

  async respondToAccessRequest(
    requestId: string,
    response: 'accepted' | 'declined',
    notes?: string
  ): Promise<void> {
    const requestRef = doc(this.db, `accessRequests/${requestId}`);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) throw new Error('Access request not found');

    const requestData = requestDoc.data() as AccessRequest;

    await updateDoc(requestRef, {
      status: response,
      responseDate: serverTimestamp(),
      notes: notes || ''
    });

    if (response !== 'accepted') return;

    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) throw new Error('User not logged in');

    const doctorDoc = await getDoc(doc(this.db, `users/${currentUser.uid}`));
    const doctorData = doctorDoc.data();

    const patientEHRRef = doc(this.db, this.healthRecordsSummaryPath(requestData.patientId));
    const patientEHR = await getDoc(patientEHRRef);

    if (!patientEHR.exists() || !doctorData) return;

    const ehrData = patientEHR.data() as EHRRecord;
    const healthcareProviders = ehrData.healthcareProviders || [];

    const alreadyExists = healthcareProviders.some(
      p => p.email === requestData.doctorEmail
    );

    if (!alreadyExists) {
      healthcareProviders.push({
        email: requestData.doctorEmail,
        role: requestData.doctorRole,
        name: requestData.doctorName,
        license: doctorData['license'],
        specialty: requestData.specialty,
        hospital: doctorData['hospital'],
        grantedAt: serverTimestamp(),
        grantedBy: requestData.patientId
      });
    }

    await updateDoc(patientEHRRef, {
      healthcareProviders,
      lastUpdated: serverTimestamp()
    });
  }

  async getMyAccessRequests(): Promise<AccessRequest[]> {
    const currentUser = await this.authService.waitForAuthInit();
    if (!currentUser) return [];

    const q = query(
      collection(this.db, 'accessRequests'),
      where('patientId', '==', currentUser.uid),
      orderBy('requestDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AccessRequest[];
  }

  private calculatePatientRiskLevel(
    allergies: any[],
    reactions: AllergicReaction[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentSevere = reactions.filter(r => {
      const date = new Date(r.reactionDate);
      return date > sixMonthsAgo && ['severe', 'life-threatening'].includes(r.severity);
    });

    if (recentSevere.length > 0) return 'critical';

    const highRiskAllergens = ['peanuts', 'shellfish', 'insectStings', 'medication'];
    const hasHighRisk = allergies.some(a => highRiskAllergens.includes(a.name) && a.checked);
    const allergyCount = allergies.filter(a => a.checked).length;

    if (hasHighRisk && allergyCount >= 3) return 'high';
    if (hasHighRisk || allergyCount >= 2) return 'medium';
    return 'low';
  }

  private generateRiskFactors(
    ehrData: EHRRecord,
    reactions: AllergicReaction[],
    outcomes: TreatmentOutcome[]
  ): string[] {
    const riskFactors: string[] = [];

    const severeAllergies = ehrData.allergies?.filter(
      a => a.checked && ['peanuts', 'shellfish', 'insectStings'].includes(a.name)
    );

    if (severeAllergies?.length >= 2) {
      riskFactors.push('Multiple severe allergies');
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentSevere = reactions.filter(r => {
      const date = new Date(r.reactionDate);
      return date > sixMonthsAgo && ['severe', 'life-threatening'].includes(r.severity);
    });

    if (recentSevere.length > 0) {
      riskFactors.push(`${recentSevere.length} severe reaction(s) in last 6 months`);
    }

    const poorResponses = outcomes.filter(o => o.patientResponse === 'poor' || o.patientResponse === 'fair');

    if (poorResponses.length >= 2) {
      riskFactors.push('History of poor treatment responses');
    }

    return riskFactors;
  }

  private generateRecommendations(
    ehrData: EHRRecord,
    reactions: AllergicReaction[],
    outcomes: TreatmentOutcome[],
    visits: DoctorVisit[]
  ): string[] {
    const recommendations: string[] = [];

    const severeAllergies = ehrData.allergies?.filter(
      a => a.checked && ['peanuts', 'shellfish', 'insectStings'].includes(a.name)
    );

    if (severeAllergies?.length > 0) {
      recommendations.push('Ensure patient carries emergency medication at all times');
      recommendations.push('Consider medical alert bracelet or allergy identification');
    }

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const recentReactions = reactions.filter(r => new Date(r.reactionDate) > oneMonthAgo);

    if (recentReactions.length > 0) {
      recommendations.push('Schedule follow-up within 2 weeks');
      recommendations.push('Review trigger avoidance strategies');
    }

    const activeAllergies = ehrData.allergies?.filter(a => a.checked);

    if (activeAllergies?.length >= 3) {
      recommendations.push('Regular allergy specialist consultation recommended');
    }

    const recentPoorOutcomes = outcomes.filter(
      o => o.patientResponse === 'poor' || o.patientResponse === 'fair'
    );

    if (recentPoorOutcomes.length > 0) {
      recommendations.push('Review current medication effectiveness');
      recommendations.push('Consider alternative treatment options');
    }

    return recommendations;
  }
}