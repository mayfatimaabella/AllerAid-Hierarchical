package io.ionic.starter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Helper class for managing medication notifications
 */
public class MedicationNotificationHelper {
    
    private static final String TAG = "MedicationNotifHelper";
    private static final String CHANNEL_ID = "medication_reminders";
    private static final String CHANNEL_NAME = "Medication Reminders";
    
    /**
     * Create notification channel for Android 8.0+
     */
    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Reminders for scheduled medications");
            channel.enableVibration(true);
            channel.enableLights(true);
            
            NotificationManager notificationManager = 
                context.getSystemService(NotificationManager.class);
            
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
                Log.d(TAG, "Notification channel created");
            }
        }
    }
    
    /**
     * Show a medication reminder notification
     */
    public static void showNotification(Context context, int notificationId, 
                                       String title, String body, String medId) {
        try {
            // Create notification channel if needed
            createNotificationChannel(context);
            
            // Create intent to open app when notification is tapped
            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            intent.putExtra("medId", medId);
            intent.putExtra("notification_source", "medication_reminder");
            
            PendingIntent pendingIntent = PendingIntent.getActivity(context, notificationId, 
                intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            
            // Build notification
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVibrate(new long[]{0, 500, 250, 500})
                .setCategory(NotificationCompat.CATEGORY_REMINDER);
            
            NotificationManager notificationManager = 
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            
            if (notificationManager != null) {
                notificationManager.notify(notificationId, builder.build());
                Log.d(TAG, "Notification shown: " + title);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error showing notification", e);
        }
    }
}
