package fr.questedudragon.homelink;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

/** Affichage natif des notifications reçues par le lien maison (fonctionne appli fermée). */
public final class LinkNotifications {
    private LinkNotifications() {}

    static final String CH_SERVICE = "qd_link_service";
    static final String CH_VALIDATIONS = "qd_validations";
    static final String CH_MISSIONS = "qd_missions";
    static final int SERVICE_ID = 4207;
    static final int TAG_ID = 1;

    public static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel svc = new NotificationChannel(CH_SERVICE, "Liaison maison", NotificationManager.IMPORTANCE_MIN);
        svc.setDescription("Indique que l'appli écoute les autres téléphones de la maison.");
        svc.setShowBadge(false);
        nm.createNotificationChannel(svc);
        NotificationChannel val = new NotificationChannel(CH_VALIDATIONS, "Validations", NotificationManager.IMPORTANCE_HIGH);
        val.setDescription("Missions terminées à valider.");
        nm.createNotificationChannel(val);
        NotificationChannel mis = new NotificationChannel(CH_MISSIONS, "Missions et récompenses", NotificationManager.IMPORTANCE_HIGH);
        mis.setDescription("Missions validées, nouvelles quêtes, bonus.");
        nm.createNotificationChannel(mis);
    }

    static PendingIntent openApp(Context c, int requestCode) {
        Intent launch = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (launch == null) launch = new Intent();
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, requestCode, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static Notification serviceNotification(Context c, int peers) {
        ensureChannels(c);
        String text = peers > 0 ? "Relié à la maison" : "En attente des autres téléphones";
        return new NotificationCompat.Builder(c, CH_SERVICE)
            .setSmallIcon(R.drawable.ic_qd_notification)
            .setContentTitle("Quête du Dragon")
            .setContentText(text)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(openApp(c, 0))
            .build();
    }

    /**
     * Affiche une notification décrite par l'appli :
     * {title, body, tag, channel, actions:[{id, label, replies:[...], doneText}]}
     * fromId = appareil d'origine (destinataire des réponses "sender").
     */
    public static void show(Context c, JSONObject spec, String fromId) {
        if (spec == null) return;
        ensureChannels(c);
        String tag = spec.optString("tag", LinkStore.randomId(8));
        String channel = "validations".equals(spec.optString("channel")) ? CH_VALIDATIONS : CH_MISSIONS;
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, channel)
            .setSmallIcon(R.drawable.ic_qd_notification)
            .setContentTitle(spec.optString("title", "Quête du Dragon"))
            .setContentText(spec.optString("body"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(spec.optString("body")))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(openApp(c, tag.hashCode()));

        JSONArray actions = spec.optJSONArray("actions");
        if (actions != null) {
            for (int i = 0; i < Math.min(3, actions.length()); i++) {
                JSONObject a = actions.optJSONObject(i);
                if (a == null) continue;
                Intent it = new Intent(c, ActionReceiver.class);
                it.setAction("fr.questedudragon.homelink.ACTION." + tag + "." + i);
                it.putExtra("tag", tag);
                it.putExtra("from", fromId);
                it.putExtra("action", a.toString());
                PendingIntent pi = PendingIntent.getBroadcast(c, (tag + i).hashCode(), it,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                b.addAction(0, a.optString("label"), pi);
            }
        }
        post(c, tag, b.build());
    }

    /** Remplace une notification par un court texte de confirmation. */
    public static void confirm(Context c, String tag, String text) {
        ensureChannels(c);
        Notification n = new NotificationCompat.Builder(c, CH_VALIDATIONS)
            .setSmallIcon(R.drawable.ic_qd_notification)
            .setContentTitle("Quête du Dragon")
            .setContentText(text)
            .setSilent(true)
            .setAutoCancel(true)
            .setTimeoutAfter(4000)
            .setContentIntent(openApp(c, tag.hashCode()))
            .build();
        post(c, tag, n);
    }

    static void post(Context c, String tag, Notification n) {
        try {
            NotificationManagerCompat.from(c).notify(tag, TAG_ID, n);
        } catch (SecurityException e) {
            // Permission de notification refusée : le message reste dans la boîte de réception.
        }
    }

    public static void cancel(Context c, String tag) {
        if (tag == null || tag.isEmpty()) return;
        NotificationManagerCompat.from(c).cancel(tag, TAG_ID);
    }
}
