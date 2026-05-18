export interface UserProfile {
  uid: string;
  email: string;

  firstName: string;
  lastName: string;
  fullName: string;

  role: 'user' | 'doctor' | 'admin';

  isActive: boolean;

  dateCreated?: any;
  lastLogin?: any;
}