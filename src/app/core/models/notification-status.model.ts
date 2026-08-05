export const NotificationStatusValues = {
  SENDING: 'sending',
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RECEIVED_IN_APP: 'received_in_app',
} as const;

export type NotificationStatus =
  typeof NotificationStatusValues[keyof typeof NotificationStatusValues];