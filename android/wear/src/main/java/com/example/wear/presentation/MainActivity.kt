/* While this template provides a good starting point for using Wear Compose, you can always
 * take a look at https://github.com/android/wear-os-samples/tree/main/ComposeStarter to find the
 * most up to date changes to the libraries and their usages.
 */


package com.example.wear.presentation

import android.util.Log
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.tooling.preview.devices.WearDevices
import com.example.wear.presentation.theme.AndroidTheme
import androidx.wear.compose.material.Button
import androidx.compose.ui.platform.LocalContext
import androidx.compose.runtime.remember
import com.example.wear.presentation.communication.WearMessageClient

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()

        super.onCreate(savedInstanceState)

        setTheme(android.R.style.Theme_DeviceDefault)

        setContent {
            WearApp()
        }
    }
}

@Composable
fun WearApp() {

  AndroidTheme {

    Box(
      modifier = Modifier
        .fillMaxSize()
        .background(MaterialTheme.colors.background),
      contentAlignment = Alignment.Center
    ) {

      TimeText()

      val context = LocalContext.current
      val client = remember { WearMessageClient(context) }

      Button(

        onClick = {

          Log.d("WearBridge", "SOS BUTTON PRESSED")
          client.sendEmergency()

        }
      ) {

        Text("SOS")

      }
    }
  }
}

@Preview(device = WearDevices.SMALL_ROUND, showSystemUi = true)
@Composable
fun DefaultPreview() {
  WearApp()
}
