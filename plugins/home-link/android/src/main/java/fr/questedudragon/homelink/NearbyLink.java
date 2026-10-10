package fr.questedudragon.homelink;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;

import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Liaison Bluetooth en sortie (hors du Wi-Fi de la maison), économe en batterie :
 * AUCUNE recherche en continu. Les téléphones ne se cherchent que :
 *  - pendant une « Sortie en famille » activée à la main (arrêt automatique après 3 h, ou en décochant) ;
 *  - 2 minutes quand un message (validation, visite, câlin…) n'a pas pu partir par le Wi-Fi, au plus une fois tous les 10 min.
 * Jamais quand la batterie est sous 20 % ou en mode économie d'énergie.
 * Les messages échangés sont les mêmes (signés avec la clé de la famille) que sur le Wi-Fi.
 */
final class NearbyLink {
    private NearbyLink() {}

    static final long OUTING_MS = 3 * 3600 * 1000L;
    static final long DEMAND_MS = 2 * 60 * 1000L;
    static final long DEMAND_GAP_MS = 10 * 60 * 1000L;
    static final int MIN_BATTERY = 20;
    private static final String PREFS = "qd_nearby";

    private static final Handler main = new Handler(Looper.getMainLooper());
    private static volatile boolean running = false;
    /** endpointId -> identifiant de l'appareil de la famille */
    private static final Map<String, String> connected = new ConcurrentHashMap<>();
    private static final Map<String, String> pendingNames = new ConcurrentHashMap<>();

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    // ---------------- Autorisations ----------------

    static String[] permissions() {
        if (Build.VERSION.SDK_INT >= 33) return new String[] { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.NEARBY_WIFI_DEVICES };
        if (Build.VERSION.SDK_INT >= 31) return new String[] { Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.ACCESS_FINE_LOCATION };
        return new String[] { Manifest.permission.ACCESS_FINE_LOCATION };
    }

    static boolean permitted(Context c) {
        for (String p : permissions()) if (c.checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) return false;
        return true;
    }

    // ---------------- Modes ----------------

    static long outingUntil(Context c) { return prefs(c).getLong("outingUntil", 0); }
    static boolean outing(Context c) { return outingUntil(c) > System.currentTimeMillis(); }

    /** Sortie en famille : on / off (case à cocher dans l'appli). */
    static void setOuting(Context c, boolean on) {
        prefs(c).edit().putLong("outingUntil", on ? System.currentTimeMillis() + OUTING_MS : 0).putLong("outingStart", on ? System.currentTimeMillis() : 0).apply();
        update(c);
    }

    /**
     * Un message vient d'être mis en file : s'il n'est toujours pas parti par le Wi-Fi dans 45 s,
     * on cherche l'autre téléphone en Bluetooth pendant 2 minutes.
     */
    static void onDemand(Context context) {
        final Context c = context.getApplicationContext();
        main.postDelayed(() -> {
            if (LinkStore.outbox(c).length() == 0) return;
            long now = System.currentTimeMillis();
            if (now - prefs(c).getLong("lastDemand", 0) < DEMAND_GAP_MS) return;
            prefs(c).edit().putLong("lastDemand", now).putLong("demandUntil", now + DEMAND_MS).apply();
            update(c);
        }, 45000);
    }

    private static boolean batteryOk(Context c) {
        try {
            BatteryManager bm = (BatteryManager) c.getSystemService(Context.BATTERY_SERVICE);
            int level = bm != null ? bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) : 100;
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            boolean saver = pm != null && pm.isPowerSaveMode();
            return level >= MIN_BATTERY && !saver;
        } catch (Exception e) { return true; }
    }

    /** Démarre ou arrête la recherche selon les modes en cours ; revérifie toutes les 30 s tant qu'elle tourne. */
    static synchronized void update(Context context) {
        final Context c = context.getApplicationContext();
        long now = System.currentTimeMillis();
        boolean want = (outing(c) || prefs(c).getLong("demandUntil", 0) > now) && LinkStore.isPaired(c) && permitted(c) && batteryOk(c);
        if (outing(c) && !batteryOk(c)) prefs(c).edit().putLong("outingUntil", 0).apply();   // batterie faible : la sortie s'arrête
        if (want && !running) start(c);
        else if (!want && running) stop(c);
        if (want) main.postDelayed(() -> update(c), 30000);
    }

    static boolean running() { return running; }
    static List<String> connectedPeers() { return new ArrayList<>(connected.values()); }

    // ---------------- Recherche et connexion ----------------

    private static ConnectionsClient client(Context c) { return Nearby.getConnectionsClient(c); }
    private static String serviceId(Context c) { return "fr.questedudragon." + LinkStore.config(c).optString("familyId"); }
    private static boolean isMember(Context c, String id) { return id != null && LinkStore.peers(c).has(id); }

    private static void start(Context c) {
        running = true;
        String me = LinkStore.deviceId(c);
        try {
            client(c).startAdvertising(me, serviceId(c), lifecycle(c), new AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build())
                .addOnFailureListener(e -> { });
            client(c).startDiscovery(serviceId(c), discovery(c), new DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build())
                .addOnFailureListener(e -> { });
        } catch (Throwable e) { running = false; }
    }

    static synchronized void stop(Context context) {
        Context c = context.getApplicationContext();
        if (!running && connected.isEmpty()) return;
        running = false;
        try {
            ConnectionsClient cl = client(c);
            cl.stopAdvertising();
            cl.stopDiscovery();
            cl.stopAllEndpoints();
        } catch (Throwable ignored) { }
        connected.clear();
        pendingNames.clear();
    }

    private static EndpointDiscoveryCallback discovery(Context c) {
        return new EndpointDiscoveryCallback() {
            @Override public void onEndpointFound(String endpointId, DiscoveredEndpointInfo info) {
                String peer = info.getEndpointName();
                if (!isMember(c, peer) || connected.containsKey(endpointId)) return;
                // un seul des deux demande la connexion (le plus petit identifiant), pour éviter les collisions
                if (LinkStore.deviceId(c).compareTo(peer) > 0) return;
                try { client(c).requestConnection(LinkStore.deviceId(c), endpointId, lifecycle(c)).addOnFailureListener(e -> { }); } catch (Throwable ignored) { }
            }
            @Override public void onEndpointLost(String endpointId) { }
        };
    }

    private static ConnectionLifecycleCallback lifecycle(Context c) {
        return new ConnectionLifecycleCallback() {
            @Override public void onConnectionInitiated(String endpointId, ConnectionInfo info) {
                String peer = info.getEndpointName();
                if (!isMember(c, peer)) { try { client(c).rejectConnection(endpointId); } catch (Throwable ignored) { } return; }
                pendingNames.put(endpointId, peer);
                try { client(c).acceptConnection(endpointId, payloads(c, endpointId)); } catch (Throwable ignored) { }
            }
            @Override public void onConnectionResult(String endpointId, ConnectionResolution result) {
                String peer = pendingNames.remove(endpointId);
                if (peer == null || !result.getStatus().isSuccess()) return;
                connected.put(endpointId, peer);
                LinkStore.upsertPeer(c, peer, null, null, null, 0);
                flushTo(c, endpointId, peer);
                if (outing(c)) recordMeet(c, peer);
            }
            @Override public void onDisconnected(String endpointId) { connected.remove(endpointId); }
        };
    }

    private static PayloadCallback payloads(Context c, String endpointId) {
        return new PayloadCallback() {
            @Override public void onPayloadReceived(String id, Payload payload) {
                if (payload.getType() != Payload.Type.BYTES || payload.asBytes() == null) return;
                String line = new String(payload.asBytes(), StandardCharsets.UTF_8);
                String peer = connected.get(endpointId);
                if (line.startsWith("ACK ")) { if (peer != null) LinkStore.delivered(c, peer, line.substring(4).trim()); return; }
                try {
                    String reply = HomeLinkService.receive(c, new JSONObject(line), null);
                    if (reply.startsWith("OK ")) send(c, endpointId, "ACK " + reply.substring(3));
                } catch (Exception ignored) { }
            }
            @Override public void onPayloadTransferUpdate(String id, PayloadTransferUpdate update) { }
        };
    }

    private static void send(Context c, String endpointId, String text) {
        try { client(c).sendPayload(endpointId, Payload.fromBytes(text.getBytes(StandardCharsets.UTF_8))); } catch (Throwable ignored) { }
    }

    /** Envoie à ce téléphone tout ce qui l'attend dans la boîte d'envoi (retiré à la réception de l'accusé). */
    private static void flushTo(Context c, String endpointId, String peer) {
        JSONArray out = LinkStore.outbox(c);
        for (int i = 0; i < out.length(); i++) {
            JSONObject e = out.optJSONObject(i);
            if (e == null || !peer.equals(e.optString("to")) || e.optJSONObject("msg") == null) continue;
            send(c, endpointId, e.optJSONObject("msg").toString());
        }
    }

    /** Nouveau message pendant une connexion déjà ouverte : livré tout de suite. */
    static void flushConnected(Context c) {
        for (Map.Entry<String, String> en : connected.entrySet()) flushTo(c, en.getKey(), en.getValue());
    }

    // ---------------- Rencontres (pour l'appli) ----------------

    /** Les deux téléphones se sont trouvés pendant une sortie : l'appli fera se rencontrer les dragons. */
    private static void recordMeet(Context c, String peer) {
        try {
            JSONArray list = new JSONArray(prefs(c).getString("meets", "[]"));
            long start = prefs(c).getLong("outingStart", 0);
            for (int i = 0; i < list.length(); i++) {
                JSONObject m = list.optJSONObject(i);
                if (m != null && peer.equals(m.optString("peer")) && m.optLong("at") >= start) return;   // une fois par sortie
            }
            list.put(new JSONObject().put("peer", peer).put("at", System.currentTimeMillis()));
            while (list.length() > 10) list.remove(0);
            prefs(c).edit().putString("meets", list.toString()).apply();
            HomeLinkPlugin.notifyNearby(peer);
        } catch (Exception ignored) { }
    }

    static JSONArray takeMeets(Context c) {
        JSONArray list;
        try { list = new JSONArray(prefs(c).getString("meets", "[]")); } catch (Exception e) { list = new JSONArray(); }
        JSONArray fresh = new JSONArray();
        long seen = prefs(c).getLong("meetsSeen", 0);
        for (int i = 0; i < list.length(); i++) { JSONObject m = list.optJSONObject(i); if (m != null && m.optLong("at") > seen) fresh.put(m); }
        prefs(c).edit().putLong("meetsSeen", System.currentTimeMillis()).apply();
        return fresh;
    }
}
