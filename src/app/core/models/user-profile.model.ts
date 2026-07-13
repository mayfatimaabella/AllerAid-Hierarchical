export interface UserProfile {
  uid: string;
  email: string;

  firstName: string;
  lastName: string;
  fullName: string;

  role: 'user' | 'doctor' | 'admin';

  isActive: boolean;

  verificationStatus?: 'pending' | 'approved' | 'rejected';

  dateCreated?: any;
  lastLogin?: any;
}