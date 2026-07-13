package com.example.wear.presentation.communication

import android.content.Context
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

      val nodes =
        Wearable.getNodeClient(context)
          .connectedNodes
          .await()

      for (node in nodes) {

        Wearable.getMessageClient(context)
          .sendMessage(
            node.id,
            "/emergency",
            "START_EMERGENCY".toByteArray()
          )
          .await()

      }
    }
  }
}
