export interface ResponderInfo {
  responderName: string;
  estimatedTime: string;
  distance: number;
  estimatedArrival: number;
  emergencyId: string;
}

export interface ResponderSource {
  responderName?: string;
  responder_name?: string;
  estimatedArrival?: number;
  distance?: number;
  emergencyId?: string;
  id?: string;
}