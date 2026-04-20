package io.ionic.starter;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

/**
 * BroadcastReceiver that listens for medication notification events
 * even when the app is completely closed.
 *
 * This receiver responds to:
 * - BOOT_COMPLETED (when device reboots)
 * - SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED
 * - Custom medication notification events
 */
public class MedicationNotificationReceiver extends BroadcastReceiver {

    private static final String TAG = "MedicationNotifReceiver";
    private static final String ACTION_MEDICATION_REMINDER = "io.ionic.starter.MEDICATION_REMINDER";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "onReceive called with action: " + intent.getAction());

        if (intent == null) {
            return;
        }

        String action = intent.getAction();

        if (action == null) {
            return;
        }

        // Handle device boot completion - reschedule all medication reminders
        if (action.equals(Intent.ACTION_BOOT_COMPLETED)) {
            Log.d(TAG, "Device booted, rescheduling medication reminders");
            rescheduleAllReminders(context);
        }

        // Handle permission state changes
      if ("android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(action)) {            Log.d(TAG, "Exact alarm permission state changed");
            rescheduleAllReminders(context);
        }

        // Handle custom medication reminder action
        if (action.equals(ACTION_MEDICATION_REMINDER)) {
            Log.d(TAG, "Medication reminder triggered");
            handleMedicationReminder(context, intent);
        }
    }

    /**
     * Handle a medication reminder event
     */
    private void handleMedicationReminder(Context context, Intent intent) {
        String medId = intent.getStringExtra("medId");
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        int notificationId = intent.getIntExtra("notificationId", 0);

        Log.d(TAG, "Processing medication reminder - ID: " + notificationId +
               ", MedID: " + medId + ", Title: " + title);

        // Create and show notification (if it hasn't already been shown by Capacitor)
        if (title != null && body != null) {
            MedicationNotificationHelper.showNotification(context, notificationId, title, body, medId);
        }

        // Save event to shared preferences or database for later retrieval by app
        saveMedicationEventToStorage(context, medId, title, body, notificationId);
    }

    /**
     * Save medication event to storage so the app can retrieve it later
     */
    private void saveMedicationEventToStorage(Context context, String medId,
                                             String title, String body, int notificationId) {
        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences(
                "medication_events", Context.MODE_PRIVATE);

            long timestamp = System.currentTimeMillis();
            String eventKey = "event_" + notificationId + "_" + timestamp;

            String eventData = medId + "|" + title + "|" + body + "|" + timestamp;
            prefs.edit().putString(eventKey, eventData).apply();

            Log.d(TAG, "Saved medication event: " + eventKey);
        } catch (Exception e) {
            Log.e(TAG, "Error saving medication event", e);
        }
    }

    /**
     * Reschedule all medication reminders (useful after boot)
     */
    private void rescheduleAllReminders(Context context) {
        // This would be called by a background service or app startup
        // For now, just log it
        Log.d(TAG, "Rescheduling all reminders - will be done by app on next launch");

        // Optional: Start a background service to trigger reschedule
        Intent rescheduleIntent = new Intent(context, MedicationReminderService.class);
        rescheduleIntent.setAction("RESCHEDULE_REMINDERS");
        try {
            context.startService(rescheduleIntent);
        } catch (Exception e) {
            Log.e(TAG, "Error starting reschedule service", e);
        }
    }
}
