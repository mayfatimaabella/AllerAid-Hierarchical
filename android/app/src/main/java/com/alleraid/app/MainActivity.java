package com.alleraid.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.KeyEvent;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private long firstPressTime = 0;
  private int pressCount = 0;

  @Override
  public void onCreate(Bundle savedInstanceState) {

    // Register the custom smartwatch Capacitor plugin
    registerPlugin(WatchConnectionPlugin.class);

    super.onCreate(savedInstanceState);
  }

  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {

    if (event.getAction() == KeyEvent.ACTION_DOWN) {

      int keyCode = event.getKeyCode();

      if (keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
          keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {

        handleVolumeEmergencyPress();

        return true;
      }
    }

    return super.dispatchKeyEvent(event);
  }

  @Override
  protected void onNewIntent(Intent intent) {

    super.onNewIntent(intent);

    setIntent(intent);

    if (intent != null &&
        "WATCH_EMERGENCY".equals(intent.getAction())) {

      // Event received from the Galaxy Watch
      bridge.triggerWindowJSEvent(
        "alleraidWatchEmergency",
        "{}"
      );
    }
  }

  private void handleVolumeEmergencyPress() {

    long now = System.currentTimeMillis();

    if (now - firstPressTime > 3000) {

      firstPressTime = now;
      pressCount = 1;

    } else {

      pressCount++;
    }

    if (pressCount >= 3) {

      pressCount = 0;
      firstPressTime = 0;

      // Event from phone volume buttons
      bridge.triggerWindowJSEvent(
        "alleraidVolumeEmergency",
        "{}"
      );
    }
  }
}