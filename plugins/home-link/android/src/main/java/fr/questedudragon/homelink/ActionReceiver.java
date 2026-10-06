package fr.questedudragon.homelink;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Bouton d'une notification (Valider, Refuser, +25…) : envoie les réponses prévues par
 * l'appli sans l'ouvrir, en garde une copie locale pour que l'appli soit à jour à sa
 * prochaine ouverture, puis remplace la notification par une confirmation.
 *
 * action = {id, label, doneText, replies:[{to, type, payload, notif, dismiss}]}
 * to = "sender" (appareil d'origine), "parents", "children", "family" ou un identifiant.
 */
public class ActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context c = context.getApplicationContext();
        final String tag = intent.getStringExtra("tag");
        final String from = intent.getStringExtra("from");
        final String actionJson = intent.getStringExtra("action");
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                JSONObject action = new JSONObject(actionJson == null ? "{}" : actionJson);
                JSONArray replies = action.optJSONArray("replies");
                if (replies != null) {
                    for (int i = 0; i < replies.length(); i++) {
                        JSONObject r = replies.optJSONObject(i);
                        if (r == null) continue;
                        String to = "sender".equals(r.optString("to")) ? from : r.optString("to");
                        String payload = r.has("payload") ? String.valueOf(r.opt("payload")) : "{}";
                        String notif = r.optJSONObject("notif") != null ? r.optJSONObject("notif").toString() : "";
                        String dismiss = r.optString("dismiss", "");
                        LinkProtocol.enqueue(c, to, r.optString("type"), payload, notif, dismiss, null);
                        // Copie locale pour l'appli (ex. retirer la demande de la liste des validations).
                        JSONObject self = LinkProtocol.build(c, LinkStore.deviceId(c), r.optString("type"), payload, "", "");
                        self.put("outgoing", true);
                        LinkStore.addInbox(c, self);
                    }
                }
                String done = action.optString("doneText", "");
                if (done.isEmpty()) LinkNotifications.cancel(c, tag);
                else LinkNotifications.confirm(c, tag, done);
                HomeLinkService.requestFlush(c);
                HomeLinkPlugin.notifyInbox();
            } catch (Exception ignored) {
            } finally {
                pending.finish();
            }
        }).start();
    }
}
