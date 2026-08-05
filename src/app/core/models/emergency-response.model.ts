import { EmergencyLocation } from '../services';

export interface EmergencyResponse {
  responderId: string;
  responderName: string;
  emergencyId: string;
  location?: EmergencyLocation | null;
  estimatedArrival: number;
  distance: number;
}