package fr.questedudragon.homelink;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Map;

/**
 * Appairage par code à 6 chiffres.
 *  - Un parent ouvre une session (startPairing) en précisant le rôle du nouvel appareil.
 *  - Le nouvel appareil (join) essaie les téléphones visibles sur le Wi-Fi avec ce code.
 *  - Le parent répond avec l'identifiant et la clé de la famille, puis informe les autres membres.
 * Session valable 10 minutes, 5 essais au maximum.
 */
public final class Pairing {
    private Pairing() {}

    private static String code;
    private static String role;
    private static long expires;
    private static int attempts;

    public static synchronized JSONObject open(String forRole) throws Exception {
        code = LinkStore.randomCode();
        role = "parent".equals(forRole) ? "parent" : "child";
        expires = System.currentTimeMillis() + 10 * 60 * 1000;
        attempts = 0;
        return new JSONObject().put("code", code).put("role", role).put("expiresAt", expires);
    }

    public static synchronized void close() { code = null; }

    /** Côté parent : traite une demande d'appairage reçue sur le serveur. */
    static synchronized JSONObject handle(Context c, JSONObject req, String remote) {
        JSONObject res = new JSONObject();
        try {
            if (req == null || !LinkStore.isPaired(c) || code == null || System.currentTimeMillis() > expires) {
                return res.put("ok", false).put("error", "closed");
            }
            if (!code.equals(req.optString("code"))) {
                if (++attempts >= 5) code = null;
                return res.put("ok", false).put("error", "code");
            }
            String id = req.optString("deviceId"), name = req.optString("name");
            String joinerRole = role;
            code = null;

            LinkStore.upsertPeer(c, id, name, joinerRole, remote, req.optInt("port"));
            JSONObject cfg = LinkStore.config(c);
            res.put("ok", true)
               .put("familyId", cfg.optString("familyId"))
               .put("familyKey", cfg.optString("familyKey"))
               .put("role", joinerRole)
               .put("members", LinkStore.membersArray(c));

            // Les autres membres apprennent l'existence du nouvel appareil.
            String payload = new JSONObject().put("members", LinkStore.membersArray(c)).toString();
            LinkProtocol.enqueue(c, "family", "family.members", payload, "", "", null);
            JSONObject local = LinkProtocol.build(c, LinkStore.deviceId(c), "family.joined",
                new JSONObject().put("id", id).put("name", name).put("role", joinerRole).toString(), "", "");
            local.put("outgoing", true);
            LinkStore.addInbox(c, local);
            HomeLinkService.requestFlush(c);
            HomeLinkPlugin.notifyInbox();
            return res;
        } catch (Exception e) {
            try { return res.put("ok", false).put("error", "internal"); } catch (Exception ignored) { return res; }
        }
    }

    /**
     * Côté nouvel appareil : essaie le code auprès des téléphones visibles pendant ~25 s.
     * Bloquant : à appeler hors du fil principal.
     */
    static JSONObject join(Context c, String joinCode, String name) throws Exception {
        long deadline = System.currentTimeMillis() + 25_000;
        String lastError = "notfound";
        while (System.currentTimeMillis() < deadline) {
            for (Map.Entry<String, JSONObject> e : HomeLinkService.resolved.entrySet()) {
                String host = e.getValue().optString("host");
                int port = e.getValue().optInt("port");
                JSONObject req = new JSONObject().put("pair", new JSONObject()
                    .put("code", joinCode).put("deviceId", LinkStore.deviceId(c)).put("name", name).put("port", HomeLinkService.currentPort()));
                String line = LinkProtocol.exchange(host, port, req.toString());
                if (line == null) continue;
                JSONObject res = new JSONObject(line);
                if (res.optBoolean("ok")) {
                    JSONObject cfg = LinkStore.config(c);
                    cfg.put("familyId", res.optString("familyId"));
                    cfg.put("familyKey", res.optString("familyKey"));
                    cfg.put("role", res.optString("role"));
                    cfg.put("deviceName", name);
                    LinkStore.saveConfig(c, cfg);
                    JSONArray members = res.optJSONArray("members");
                    for (int i = 0; members != null && i < members.length(); i++) {
                        JSONObject m = members.optJSONObject(i);
                        if (m == null) continue;
                        boolean isHost = i == 0; // l'hôte se place en premier
                        LinkStore.upsertPeer(c, m.optString("id"), m.optString("name"), m.optString("role"),
                            isHost ? host : m.optString("host"), isHost ? port : m.optInt("port"));
                    }
                    HomeLinkService s = HomeLinkService.get();
                    if (s != null) s.registerSelf();
                    return res;
                }
                String err = res.optString("error");
                if ("code".equals(err)) throw new Exception("Code incorrect.");
                lastError = err;
            }
            Thread.sleep(1500);
        }
        throw new Exception("closed".equals(lastError)
            ? "Le téléphone parent n'est pas en attente d'appairage."
            : "Aucun téléphone de la famille trouvé sur le Wi-Fi.");
    }
}
