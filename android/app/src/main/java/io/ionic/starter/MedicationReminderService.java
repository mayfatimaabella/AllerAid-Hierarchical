package io.ionic.starter;

import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.IBinder;
import android.util.Log;

/**
 * Background service for handling medication reminder tasks
 * This service runs when medication reminders need to be processed
 */
public class MedicationReminderService extends Service {
    
    private static final String TAG = "MedicationReminderSvc";
    
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "Service started");
        
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        
        String action = intent.getAction();
        
        if ("RESCHEDULE_REMINDERS".equals(action)) {
            Log.d(TAG, "Rescheduling all medication reminders");
            rescheduleReminders();
        } else if ("HANDLE_NOTIFICATION".equals(action)) {
            handleNotificationEvent(intent);
        }
        
        stopSelf(startId);
        return START_NOT_STICKY;
    }
    
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
    
    /**
     * Reschedule all medication reminders
     * This is called after device boot or when permissions change
     */
    private void rescheduleReminders() {
        try {
            Log.d(TAG, "Attempting to reschedule reminders");
            // The actual reschedule logic will be triggered by the app when it next opens
            // This is a placeholder for future enhancement
        } catch (Exception e) {
            Log.e(TAG, "Error rescheduling reminders", e);
        }
    }
    
    /**
     * Handle a notification event that occurred in the background
     */
    private void handleNotificationEvent(Intent intent) {
        try {
            String medId = intent.getStringExtra("medId");
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            int notificationId = intent.getIntExtra("notificationId", 0);
            
            Log.d(TAG, "Handling notification event: " + title);
            
            // Save the event to shared preferences
            saveNotificationEvent(medId, title, body, notificationId);
            
            // Show the notification
            MedicationNotificationHelper.showNotification(this, notificationId, title, body, medId);
        } catch (Exception e) {
            Log.e(TAG, "Error handling notification event", e);
        }
    }
    
    /**
     * Save notification event to shared preferences for app to retrieve later
     */
    private void saveNotificationEvent(String medId, String title, String body, int notificationId) {
        try {
            SharedPreferences prefs = getSharedPreferences("medication_events", MODE_PRIVATE);
            long timestamp = System.currentTimeMillis();
            String eventKey = "event_" + notificationId + "_" + timestamp;
            String eventData = medId + "|" + title + "|" + body + "|" + timestamp;
            
            prefs.edit().putString(eventKey, eventData).apply();
            
            Log.d(TAG, "Saved notification event: " + eventKey);
        } catch (Exception e) {
            Log.e(TAG, "Error saving notification event", e);
        }
    }
}
