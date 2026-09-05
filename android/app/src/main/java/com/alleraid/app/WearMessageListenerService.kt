package com.alleraid.app

import android.content.Intent
import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService

class WearMessageListenerService : WearableListenerService() {

    override fun onMessageReceived(messageEvent: MessageEvent) {

        super.onMessageReceived(messageEvent)

        if (messageEvent.path == "/emergency") {

            val message = String(messageEvent.data)

            Log.d("WearListener", "Received: $message")

            if (message == "START_EMERGENCY") {

                Log.d(
                    "WearListener",
                    "🚨 WATCH EMERGENCY TRIGGERED"
                )

                val intent = Intent(
                    this,
                    MainActivity::class.java
                )

                intent.action = "WATCH_EMERGENCY"

                intent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                )

                startActivity(intent)
            }
        }
    }
}