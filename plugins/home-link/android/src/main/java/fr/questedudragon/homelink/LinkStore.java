package fr.questedudragon.homelink;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.security.SecureRandom;
import java.util.Iterator;

/**
 * Persistance locale du lien maison (SharedPreferences) : configuration de l'appareil,
 * membres de la famille, boîte d'envoi (messages en attente de livraison) et boîte de
 * réception (messages reçus pas encore traités par l'appli).
 * Toutes les méthodes sont synchronisées : le service, le récepteur de notifications
 * et le plugin y accèdent depuis des fils différents.
 */
public final class LinkStore {
    private static final String PREFS = "home_link";
    private static final int MAX_INBOX = 500;
    private static final int MAX_SEEN = 400;
    private static final long OUTBOX_TTL_MS = 7L * 24 * 3600 * 1000;

    private LinkStore() {}

    private static SharedPreferences prefs(Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject readObj(Context c, String key) {
        try { return new JSONObject(prefs(c).getString(key, "{}")); } catch (JSONException e) { return new JSONObject(); }
    }

    private static JSONArray readArr(Context c, String key) {
        try { return new JSONArray(prefs(c).getString(key, "[]")); } catch (JSONException e) { return new JSONArray(); }
    }

    private static void write(Context c, String key, Object value) {
        prefs(c).edit().putString(key, value.toString()).apply();
    }

    // ---------------- Configuration ----------------

    /** deviceId, deviceName, role (child|parent), familyId, familyKey. */
    public static synchronized JSONObject config(Context c) {
        JSONObject cfg = readObj(c, "config");
        if (!cfg.has("deviceId")) {
            try { cfg.put("deviceId", randomId(12)); } catch (JSONException ignored) {}
            write(c, "config", cfg);
        }
        return cfg;
    }

    public static synchronized void saveConfig(Context c, JSONObject cfg) { write(c, "config", cfg); }

    public static String deviceId(Context c) { return config(c).optString("deviceId"); }

    public static boolean isPaired(Context c) {
        JSONObject cfg = config(c);
        return cfg.optString("familyId").length() > 0 && cfg.optString("familyKey").length() > 0;
    }

    public static synchronized void reset(Context c) {
        String id = deviceId(c);
        prefs(c).edit().clear().apply();
        try { write(c, "config", new JSONObject().put("deviceId", id)); } catch (JSONException ignored) {}
    }

    // ---------------- Membres ----------------

    /** deviceId -> {name, role, host, port, lastSeen} */
    public static synchronized JSONObject peers(Context c) { return readObj(c, "peers"); }

    public static synchronized void upsertPeer(Context c, String id, String name, String role, String host, int port) {
        if (id == null || id.isEmpty() || id.equals(deviceId(c))) return;
        JSONObject peers = peers(c);
        JSONObject p = peers.optJSONObject(id);
        if (p == null) p = new JSONObject();
        try {
            if (name != null && !name.isEmpty()) p.put("name", name);
            if (role != null && !role.isEmpty()) p.put("role", role);
            if (host != null && !host.isEmpty()) p.put("host", host);
            if (port > 0) p.put("port", port);
            p.put("lastSeen", System.currentTimeMillis());
            peers.put(id, p);
        } catch (JSONException ignored) {}
        write(c, "peers", peers);
    }

    public static synchronized void removePeer(Context c, String id) {
        JSONObject peers = peers(c);
        peers.remove(id);
        write(c, "peers", peers);
    }

    // ---------------- Boîte d'envoi ----------------

    public static synchronized void enqueue(Context c, String to, JSONObject message) {
        JSONArray out = readArr(c, "outbox");
        try {
            out.put(new JSONObject().put("to", to).put("msg", message).put("created", System.currentTimeMillis()).put("attempts", 0));
        } catch (JSONException ignored) {}
        write(c, "outbox", out);
    }

    public static synchronized JSONArray outbox(Context c) { return readArr(c, "outbox"); }

    /** Retire un message livré (par identifiant de message et destinataire). */
    public static synchronized void delivered(Context c, String to, String id) {
        JSONArray out = readArr(c, "outbox"), keep = new JSONArray();
        for (int i = 0; i < out.length(); i++) {
            JSONObject e = out.optJSONObject(i);
            if (e == null) continue;
            if (to.equals(e.optString("to")) && id.equals(e.optJSONObject("msg") != null ? e.optJSONObject("msg").optString("id") : "")) continue;
            keep.put(e);
        }
        write(c, "outbox", keep);
    }

    /** Incrémente les tentatives et supprime les messages trop anciens. */
    public static synchronized void failed(Context c, String to, String id) {
        JSONArray out = readArr(c, "outbox"), keep = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < out.length(); i++) {
            JSONObject e = out.optJSONObject(i);
            if (e == null || now - e.optLong("created") > OUTBOX_TTL_MS) continue;
            JSONObject msg = e.optJSONObject("msg");
            if (msg != null && to.equals(e.optString("to")) && id.equals(msg.optString("id"))) {
                try { e.put("attempts", e.optInt("attempts") + 1); } catch (JSONException ignored) {}
            }
            keep.put(e);
        }
        write(c, "outbox", keep);
    }

    // ---------------- Boîte de réception ----------------

    /** Ajoute un message s'il n'a pas déjà été reçu. Retourne false pour un doublon. */
    public static synchronized boolean addInbox(Context c, JSONObject message) {
        String id = message.optString("id");
        JSONArray seen = readArr(c, "seen");
        for (int i = 0; i < seen.length(); i++) if (id.equals(seen.optString(i))) return false;
        seen.put(id);
        while (seen.length() > MAX_SEEN) seen.remove(0);
        write(c, "seen", seen);

        JSONArray inbox = readArr(c, "inbox");
        inbox.put(message);
        while (inbox.length() > MAX_INBOX) inbox.remove(0);
        write(c, "inbox", inbox);
        return true;
    }

    public static synchronized JSONArray drainInbox(Context c) {
        JSONArray inbox = readArr(c, "inbox");
        write(c, "inbox", new JSONArray());
        return inbox;
    }

    // ---------------- Utilitaires ----------------

    private static final SecureRandom RNG = new SecureRandom();
    private static final char[] ALPHA = "abcdefghijkmnpqrstuvwxyz23456789".toCharArray();

    public static String randomId(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) sb.append(ALPHA[RNG.nextInt(ALPHA.length)]);
        return sb.toString();
    }

    public static String randomKey() {
        byte[] b = new byte[32];
        RNG.nextBytes(b);
        return android.util.Base64.encodeToString(b, android.util.Base64.NO_WRAP);
    }

    public static String randomCode() {
        return String.format(java.util.Locale.ROOT, "%06d", RNG.nextInt(1_000_000));
    }

    public static JSONArray membersArray(Context c) {
        JSONArray arr = new JSONArray();
        JSONObject cfg = config(c);
        try {
            arr.put(new JSONObject().put("id", cfg.optString("deviceId")).put("name", cfg.optString("deviceName")).put("role", cfg.optString("role")));
            JSONObject peers = peers(c);
            Iterator<String> it = peers.keys();
            while (it.hasNext()) {
                String id = it.next();
                JSONObject p = peers.optJSONObject(id);
                if (p == null) continue;
                arr.put(new JSONObject().put("id", id).put("name", p.optString("name")).put("role", p.optString("role"))
                    .put("host", p.optString("host")).put("port", p.optInt("port")));
            }
        } catch (JSONException ignored) {}
        return arr;
    }
}
