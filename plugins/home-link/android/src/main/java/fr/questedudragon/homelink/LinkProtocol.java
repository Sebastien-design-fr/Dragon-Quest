package fr.questedudragon.homelink;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * Format des messages échangés entre les téléphones (une ligne JSON par connexion TCP),
 * signature HMAC-SHA256 avec la clé de la famille, et livraison.
 *
 * Message : {v, id, from, fromName, role, fam, to, type, ts, port, payload, notif, dismiss, sig}
 *  - payload : chaîne JSON (contenu métier, interprété par l'appli)
 *  - notif   : chaîne JSON optionnelle, notification à afficher chez le destinataire
 *  - dismiss : étiquette de notification à faire disparaître chez le destinataire
 */
public final class LinkProtocol {
    private LinkProtocol() {}

    static final int CONNECT_TIMEOUT_MS = 3000;
    static final int READ_TIMEOUT_MS = 6000;

    public static JSONObject build(Context c, String to, String type, String payload, String notif, String dismiss) throws JSONException {
        JSONObject cfg = LinkStore.config(c);
        JSONObject m = new JSONObject();
        m.put("v", 1);
        m.put("id", LinkStore.randomId(16));
        m.put("from", cfg.optString("deviceId"));
        m.put("fromName", cfg.optString("deviceName"));
        m.put("role", cfg.optString("role"));
        m.put("fam", cfg.optString("familyId"));
        m.put("to", to);
        m.put("type", type);
        m.put("ts", System.currentTimeMillis());
        m.put("port", HomeLinkService.currentPort());
        m.put("payload", payload == null ? "{}" : payload);
        m.put("notif", notif == null ? "" : notif);
        m.put("dismiss", dismiss == null ? "" : dismiss);
        m.put("sig", sign(cfg.optString("familyKey"), m));
        return m;
    }

    static String canonical(JSONObject m) {
        return m.optString("id") + "\n" + m.optString("from") + "\n" + m.optString("to") + "\n" + m.optString("type") + "\n"
            + m.optLong("ts") + "\n" + m.optString("payload") + "\n" + m.optString("notif") + "\n" + m.optString("dismiss");
    }

    static String sign(String key, JSONObject m) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] h = mac.doFinal(canonical(m).getBytes(StandardCharsets.UTF_8));
            return android.util.Base64.encodeToString(h, android.util.Base64.NO_WRAP);
        } catch (Exception e) {
            return "";
        }
    }

    /** Vérifie la famille, le destinataire et la signature (comparaison à temps constant). */
    public static boolean verify(Context c, JSONObject m) {
        JSONObject cfg = LinkStore.config(c);
        String fam = cfg.optString("familyId"), key = cfg.optString("familyKey");
        if (fam.isEmpty() || key.isEmpty()) return false;
        if (!fam.equals(m.optString("fam"))) return false;
        if (!cfg.optString("deviceId").equals(m.optString("to"))) return false;
        String expected = sign(key, m), got = m.optString("sig");
        if (expected.length() != got.length() || expected.isEmpty()) return false;
        int diff = 0;
        for (int i = 0; i < expected.length(); i++) diff |= expected.charAt(i) ^ got.charAt(i);
        return diff == 0;
    }

    /** Destinataires : "parents", "children", "family" (tous sauf soi) ou un identifiant d'appareil. */
    public static List<String> recipients(Context c, String to, String excludeId) {
        List<String> ids = new ArrayList<>();
        JSONObject peers = LinkStore.peers(c);
        if ("parents".equals(to) || "children".equals(to) || "family".equals(to)) {
            String wanted = "parents".equals(to) ? "parent" : "children".equals(to) ? "child" : null;
            Iterator<String> it = peers.keys();
            while (it.hasNext()) {
                String id = it.next();
                JSONObject p = peers.optJSONObject(id);
                if (p == null || id.equals(excludeId)) continue;
                if (wanted == null || wanted.equals(p.optString("role"))) ids.add(id);
            }
        } else if (to != null && !to.isEmpty()) {
            ids.add(to);
        }
        return ids;
    }

    /** Construit, signe et met en file un message pour chaque destinataire. Retourne les identifiants. */
    public static JSONArray enqueue(Context c, String to, String type, String payload, String notif, String dismiss, String excludeId) throws JSONException {
        JSONArray ids = new JSONArray();
        for (String id : recipients(c, to, excludeId)) {
            JSONObject m = build(c, id, type, payload, notif, dismiss);
            LinkStore.enqueue(c, id, m);
            ids.put(m.optString("id"));
        }
        return ids;
    }

    /** Envoie une ligne et attend la réponse (une ligne). Retourne null en cas d'échec. */
    public static String exchange(String host, int port, String line) {
        if (host == null || host.isEmpty() || port <= 0) return null;
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), CONNECT_TIMEOUT_MS);
            s.setSoTimeout(READ_TIMEOUT_MS);
            OutputStream out = s.getOutputStream();
            out.write((line + "\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
            BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
            return in.readLine();
        } catch (Exception e) {
            return null;
        }
    }

    /** Tente de livrer toute la boîte d'envoi. Retourne le nombre de messages livrés. */
    public static int flush(Context c) {
        JSONArray out = LinkStore.outbox(c);
        JSONObject peers = LinkStore.peers(c);
        int delivered = 0;
        for (int i = 0; i < out.length(); i++) {
            JSONObject e = out.optJSONObject(i);
            if (e == null) continue;
            String to = e.optString("to");
            JSONObject msg = e.optJSONObject("msg");
            JSONObject peer = peers.optJSONObject(to);
            if (msg == null || peer == null) continue;
            String reply = exchange(peer.optString("host"), peer.optInt("port"), msg.toString());
            if (reply != null && reply.startsWith("OK")) {
                LinkStore.delivered(c, to, msg.optString("id"));
                LinkStore.upsertPeer(c, to, null, null, null, 0); // met à jour lastSeen
                delivered++;
            } else {
                LinkStore.failed(c, to, msg.optString("id"));
            }
        }
        return delivered;
    }
}
