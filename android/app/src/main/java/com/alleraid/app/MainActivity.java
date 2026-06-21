package com.alleraid.app;

import android.view.KeyEvent;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  private long firstPressTime = 0;
  private int pressCount = 0;

  @Override
  public boolean dispatchKeyEvent(KeyEvent event) {
    if (event.getAction() == KeyEvent.ACTION_DOWN) {
      int keyCode = event.getKeyCode();

      if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
        handleVolumeEmergencyPress();

        // true = app handles the volume button
        // false = volume still changes normally
        return true;
      }
    }

    return super.dispatchKeyEvent(event);
  }

  private void handleVolumeEmergencyPress() {
    long now = System.currentTimeMillis();

    // Reset if presses are too far apart
    if (now - firstPressTime > 3000) {
      firstPressTime = now;
      pressCount = 1;
    } else {
      pressCount++;
    }

    if (pressCount >= 3) {
      pressCount = 0;
      firstPressTime = 0;

      bridge.triggerWindowJSEvent("alleraidVolumeEmergency", "{}");
    }
  }
}