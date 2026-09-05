package com.alleraid.app;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.wearable.Node;
import com.google.android.gms.wearable.Wearable;

@CapacitorPlugin(name = "WatchConnection")
public class WatchConnectionPlugin extends Plugin {

    private static final String TAG = "WatchConnection";

    @PluginMethod
    public void isConnected(PluginCall call) {

        Wearable.getNodeClient(getContext())
                .getConnectedNodes()
                .addOnSuccessListener(nodes -> {

                    boolean connected = !nodes.isEmpty();

                    String watchName = "";
                    String nodeId = "";

                    if (connected) {

                        Node watch = nodes.get(0);

                        watchName = watch.getDisplayName();
                        nodeId = watch.getId();

                        Log.d(
                            TAG,
                            "Connected watch: "
                                + watchName
                                + " ("
                                + nodeId
                                + ")"
                        );
                    }

                    JSObject result = new JSObject();

                    result.put("connected", connected);
                    result.put("name", watchName);
                    result.put("nodeId", nodeId);

                    call.resolve(result);
                })
                .addOnFailureListener(error -> {

                    Log.e(
                        TAG,
                        "Unable to check smartwatch connection",
                        error
                    );

                    call.reject(
                        "Unable to check smartwatch connection",
                        error
                    );
                });
    }
}