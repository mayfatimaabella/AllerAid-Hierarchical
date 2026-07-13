package com.alleraid.app

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

        Log.d("WearListener", "Emergency Triggered")

        // We'll connect this to Ionic later.

      }

    }

  }

}
