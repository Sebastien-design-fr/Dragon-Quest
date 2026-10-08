package fr.questedudragon.homelink;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Widget d'écran d'accueil (refonte UX, point 5) : le dragon, ses quêtes du jour et la prochaine à faire.
 * L'appli envoie un résumé des 7 prochains jours (updateWidget) ; le widget choisit le jour courant,
 * même si l'appli n'a pas été rouverte depuis minuit. Toucher le widget ouvre l'appli.
 */
public class DragonWidget extends AppWidgetProvider {
    static final String PREFS = "qd_widget";

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, render(context));
    }

    /** Données envoyées par l'appli (JSON), puis mise à jour de tous les widgets posés. */
    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("data", json).apply();
        refresh(c);
        toWatch(c, json);
    }

    /** Même résumé envoyé à la montre (tuile Galaxy Watch) ; sans montre ni services Google, rien ne se passe. */
    private static void toWatch(Context c, String json) {
        try {
            com.google.android.gms.wearable.PutDataMapRequest req = com.google.android.gms.wearable.PutDataMapRequest.create("/qd/status");
            req.getDataMap().putString("json", json);
            req.getDataMap().putLong("t", System.currentTimeMillis());
            com.google.android.gms.wearable.Wearable.getDataClient(c.getApplicationContext()).putDataItem(req.asPutDataRequest().setUrgent());
        } catch (Throwable ignored) { }
    }

    static void refresh(Context c) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(c);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(c, DragonWidget.class));
        if (ids == null || ids.length == 0) return;
        RemoteViews v = render(c);
        for (int id : ids) mgr.updateAppWidget(id, v);
    }

    private static RemoteViews render(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.qd_widget);
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open != null) {
            open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            v.setOnClickPendingIntent(R.id.qd_root, PendingIntent.getActivity(c, 7301, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONObject d = new JSONObject(p.getString("data", "{}"));
            String name = d.optString("name", "Ton dragon");
            v.setTextViewText(R.id.qd_name, name);
            v.setTextViewText(R.id.qd_sub, d.optString("sub", ""));
            Bitmap img = loadAsset(c, d.optString("image", ""));
            if (img != null) v.setImageViewBitmap(R.id.qd_dragon, img);

            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.FRANCE).format(new Date());
            JSONObject day = null;
            JSONArray days = d.optJSONArray("days");
            if (days != null) for (int i = 0; i < days.length(); i++) {
                JSONObject x = days.optJSONObject(i);
                if (x != null && today.equals(x.optString("date"))) { day = x; break; }
            }
            int streak = d.optInt("streak", 0);
            v.setTextViewText(R.id.qd_streak, streak > 0 ? ("🔥 " + streak) : "");
            v.setViewVisibility(R.id.qd_streak, streak > 0 ? View.VISIBLE : View.GONE);
            if (day == null) {
                v.setTextViewText(R.id.qd_count, "—");
                v.setTextViewText(R.id.qd_next, "Ouvre l’appli pour voir tes quêtes");
                v.setProgressBar(R.id.qd_bar, 1, 0, false);
                return v;
            }
            int total = day.optInt("total", 0), done = day.optInt("done", 0);
            v.setTextViewText(R.id.qd_count, total == 0 ? "Repos" : (done + " / " + total));
            v.setProgressBar(R.id.qd_bar, Math.max(1, total), Math.min(done, Math.max(1, total)), false);
            String next = day.optString("next", "");
            String status = d.optString("status", "");
            String line;
            if (total == 0) line = "Pas de quête aujourd’hui";
            else if (done >= total) line = "Journée parfaite ! " + name + " est fier de toi";
            else if (!next.isEmpty()) line = "Prochaine : " + next;
            else line = "En attente des parents";
            if (!status.isEmpty() && today.equals(d.optString("statusDate"))) line = status + " · " + line;
            // téléphone d'un parent : ligne dédiée (demandes à valider…)
            String parentLine = d.optString("line", "");
            if (!parentLine.isEmpty() && today.equals(d.optString("statusDate"))) line = parentLine;
            v.setTextViewText(R.id.qd_next, line);
        } catch (Exception e) {
            v.setTextViewText(R.id.qd_next, "Ouvre l’appli pour voir tes quêtes");
        }
        return v;
    }

    /** Illustration du dragon depuis les fichiers de l'appli, réduite (les widgets ont peu de mémoire). */
    private static Bitmap loadAsset(Context c, String path) {
        if (path == null || path.isEmpty()) return null;
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            try (InputStream in = c.getAssets().open("public/" + path)) { BitmapFactory.decodeStream(in, null, o); }
            int sample = 1;
            while (o.outWidth / (sample * 2) >= 420) sample *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            try (InputStream in = c.getAssets().open("public/" + path)) { return BitmapFactory.decodeStream(in, null, o2); }
        } catch (Exception e) {
            return null;
        }
    }
}
