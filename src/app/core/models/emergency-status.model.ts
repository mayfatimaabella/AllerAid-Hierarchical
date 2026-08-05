export const EmergencyStatusValues = {
  ACTIVE: 'active',
  RESPONDING: 'responding',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled',
} as const;

export type EmergencyStatus =
  typeof EmergencyStatusValues[keyof typeof EmergencyStatusValues];