package com.example.wear.presentation.communication

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class WearMessageClient(
  private val context: Context
) {

  fun sendEmergency() {

    CoroutineScope(Dispatchers.IO).launch {

      try {

        val nodes = Wearable.getNodeClient(context)
          .connectedNodes
          .await()

        if (nodes.isEmpty()) {
          Log.e("WearBridge", "No connected phone found.")
          return@launch
        }

        for (node in nodes) {

          Log.d("WearBridge", "Sending emergency to ${node.displayName}")

          Wearable.getMessageClient(context)
            .sendMessage(
              node.id,
              "/emergency",
              "START_EMERGENCY".toByteArray()
            )
            .await()

          Log.d("WearBridge", "Emergency sent successfully.")
        }

      } catch (e: Exception) {
        Log.e("WearBridge", "Failed to send emergency", e)
      }
    }
  }
}
