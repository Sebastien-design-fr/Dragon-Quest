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
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Widget d'écran d'accueil : le dragon, ses quêtes du jour et la prochaine à faire.
 * Trois présentations choisies selon la taille donnée au widget (petit, moyen, grand) ;
 * le dragon change d'image selon son état (il dort la nuit, il vole de joie après une journée parfaite) ;
 * « J'ai fait » valide une quête de confiance sans ouvrir l'appli (l'XP est comptée à la prochaine ouverture) ;
 * « Câlin » ouvre l'appli sur le dragon. Côté parent : la journée de l'enfant et les demandes à valider.
 * L'appli envoie un résumé (updateWidget) ; le widget choisit le jour courant, même après minuit.
 */
public class DragonWidget extends AppWidgetProvider {
    static final String PREFS = "qd_widget";
    static final String ACTION_DONE = "fr.questedudragon.homelink.WIDGET_DONE";
    static final int MAX_ROWS = 5;

    enum Kind { SMALL, MEDIUM, LARGE, COVER }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) mgr.updateAppWidget(id, build(context, mgr, id));
        // en passant : relève les pas du jour (le widget est mis à jour toutes les 30 min)
        StepCounter.readOnce(context, () -> { });
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle newOptions) {
        mgr.updateAppWidget(id, build(context, mgr, id));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_DONE.equals(intent.getAction())) {
            markDone(context.getApplicationContext(), intent.getStringExtra("missionId"));
            return;
        }
        super.onReceive(context, intent);
    }

    /** Présentation fixe (écran externe) ; null = selon la taille. */
    protected Kind fixedKind() { return null; }

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
        refreshProvider(c, mgr, new ComponentName(c, DragonWidget.class), new DragonWidget());
        refreshProvider(c, mgr, new ComponentName(c, DragonCoverWidget.class), new DragonCoverWidget());
    }

    private static void refreshProvider(Context c, AppWidgetManager mgr, ComponentName cn, DragonWidget p) {
        int[] ids;
        try { ids = mgr.getAppWidgetIds(cn); } catch (Exception e) { return; }
        if (ids == null) return;
        for (int id : ids) mgr.updateAppWidget(id, p.build(c, mgr, id));
    }

    // ---------------- Présentation ----------------

    RemoteViews build(Context c, AppWidgetManager mgr, int id) {
        Kind fixed = fixedKind();
        if (fixed != null) return render(c, fixed);
        if (Build.VERSION.SDK_INT >= 31) {
            Map<SizeF, RemoteViews> m = new HashMap<>();
            m.put(new SizeF(100f, 90f), render(c, Kind.SMALL));
            m.put(new SizeF(220f, 90f), render(c, Kind.MEDIUM));
            m.put(new SizeF(220f, 250f), render(c, Kind.LARGE));
            return new RemoteViews(m);
        }
        Bundle o = mgr.getAppWidgetOptions(id);
        int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110);
        return render(c, w < 200 ? Kind.SMALL : h >= 240 ? Kind.LARGE : Kind.MEDIUM);
    }

    private static int layoutOf(Kind k) {
        switch (k) {
            case SMALL: return R.layout.qd_widget_small;
            case LARGE: return R.layout.qd_widget_large;
            case COVER: return R.layout.qd_widget_cover;
            default: return R.layout.qd_widget;
        }
    }

    private static PendingIntent open(Context c, String action, int code) {
        Intent it = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (it == null) return null;
        it.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (action != null) it.putExtra(HomeLinkPlugin.EXTRA_OPEN, action);
        return PendingIntent.getActivity(c, code, it, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent doneIntent(Context c, String missionId) {
        Intent it = new Intent(c, DragonWidget.class);
        it.setAction(ACTION_DONE);
        it.putExtra("missionId", missionId);
        return PendingIntent.getBroadcast(c, 7400 + (missionId.hashCode() & 0xffff), it, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String today() { return new SimpleDateFormat("yyyy-MM-dd", Locale.FRANCE).format(new Date()); }

    private static boolean night() { int h = Calendar.getInstance().get(Calendar.HOUR_OF_DAY); return h >= 22 || h < 7; }

    static RemoteViews render(Context c, Kind kind) {
        RemoteViews v = new RemoteViews(c.getPackageName(), layoutOf(kind));
        PendingIntent home = open(c, "dragon", 7301);
        if (home != null) v.setOnClickPendingIntent(R.id.qd_root, home);
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONObject d = new JSONObject(p.getString("data", "{}"));
            String today = today();
            String name = d.optString("name", "Ton dragon");
            JSONObject child = d.optJSONObject("child");
            boolean parent = d.has("line") && !d.isNull("line");
            boolean halloween = "halloween".equals(d.optString("event"));
            if (halloween) v.setInt(R.id.qd_root, "setBackgroundResource", R.drawable.qd_widget_bg_halloween);

            // quêtes du jour (enfant : les siennes ; parent : celles de l'enfant)
            JSONObject day = null;
            JSONArray days = d.optJSONArray("days");
            if (days != null) for (int i = 0; i < days.length(); i++) {
                JSONObject x = days.optJSONObject(i);
                if (x != null && today.equals(x.optString("date"))) { day = x; break; }
            }
            boolean fresh = today.equals(d.optString("statusDate"));
            int total, done;
            if (parent && child != null && fresh) { total = child.optInt("total"); done = child.optInt("done"); }
            else if (!parent && day != null) { total = day.optInt("total", 0); done = day.optInt("done", 0); }
            else { total = -1; done = 0; }

            // image selon l'état : endormi, joyeux (journée parfaite), normal
            String img = d.optString("image", "");
            int hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY);
            boolean asleep = night() || (d.optBoolean("asleep") && fresh && hour < 12) || (d.optBoolean("asleep") && fresh && hour >= 20);
            if (asleep && !d.optString("sleepImage").isEmpty()) img = d.optString("sleepImage");
            else if (!parent && total > 0 && done >= total && !d.optString("happyImage").isEmpty()) img = d.optString("happyImage");
            Bitmap bmp = loadAsset(c, img, kind == Kind.SMALL ? 280 : 360);
            if (bmp != null) v.setImageViewBitmap(R.id.qd_dragon, bmp);

            v.setTextViewText(R.id.qd_count, total < 0 ? "—" : total == 0 ? "Repos" : (done + " / " + total));
            v.setProgressBar(R.id.qd_bar, Math.max(1, total), Math.max(0, Math.min(done, Math.max(1, total))), false);
            if (kind == Kind.SMALL) return v;

            v.setTextViewText(R.id.qd_name, name);
            v.setTextViewText(R.id.qd_sub, d.optString("sub", ""));
            int streak = d.optInt("streak", 0);
            String badge = ((halloween ? "🎃 " : "") + (streak > 0 ? "🔥 " + streak : "")).trim();
            v.setTextViewText(R.id.qd_streak, badge);
            v.setViewVisibility(R.id.qd_streak, badge.isEmpty() ? View.GONE : View.VISIBLE);

            // ligne d'état
            String next = day != null ? day.optString("next", "") : "";
            String status = fresh ? d.optString("status", "") : "";
            String line;
            if (parent) line = fresh ? d.optString("line", "Tout est à jour") : "Ouvre l’appli pour voir la journée";
            else if (total < 0) line = "Ouvre l’appli pour voir tes quêtes";
            else if (total == 0) line = "Pas de quête aujourd’hui";
            else if (done >= total) line = "Journée parfaite ! " + name + " est fier de toi";
            else if (!next.isEmpty()) line = "Prochaine : " + next;
            else line = "En attente des parents";
            if (!parent && !status.isEmpty()) line = status + " · " + line;
            if (asleep && !parent && (total <= 0 || done >= total)) line = name + " dort… à demain !";
            v.setTextViewText(R.id.qd_next, line);
            PendingIntent quests = open(c, parent ? "validations" : "missions", 7310);
            if (quests != null) v.setOnClickPendingIntent(R.id.qd_next, quests);

            // boutons
            PendingIntent pet = open(c, "pet", 7311);
            if (pet != null) v.setOnClickPendingIntent(R.id.qd_btn_pet, pet);
            JSONArray qs = d.optJSONArray("quests");
            String doneId = null;
            if (!parent && fresh && qs != null) for (int i = 0; i < qs.length(); i++) {
                JSONObject q = qs.optJSONObject(i);
                if (q != null && q.optBoolean("trust") && isTodo(q.optString("status"))) { doneId = q.optString("id"); break; }
            }
            if (parent) {
                int pending = child != null ? child.optInt("pending") : 0;
                v.setTextViewText(R.id.qd_btn_done, pending > 0 ? "Valider (" + pending + ")" : "Accueil");
                if (quests != null) v.setOnClickPendingIntent(R.id.qd_btn_done, quests);
                v.setViewVisibility(R.id.qd_btn_done, View.VISIBLE);
            } else if (doneId != null && kind != Kind.LARGE) {
                v.setTextViewText(R.id.qd_btn_done, "✓ J’ai fait");
                v.setOnClickPendingIntent(R.id.qd_btn_done, doneIntent(c, doneId));
                v.setViewVisibility(R.id.qd_btn_done, View.VISIBLE);
            } else v.setViewVisibility(R.id.qd_btn_done, View.GONE);

            if (kind == Kind.LARGE) fillRows(c, v, parent ? (child != null && fresh ? child.optJSONArray("quests") : null) : (fresh ? qs : null), parent);
        } catch (Exception e) {
            v.setTextViewText(R.id.qd_next, "Ouvre l’appli pour voir tes quêtes");
        }
        return v;
    }

    private static boolean isTodo(String s) { return "todo".equals(s) || "refused".equals(s); }

    private static final int[] ROWS = { R.id.qd_q0, R.id.qd_q1, R.id.qd_q2, R.id.qd_q3, R.id.qd_q4 };
    private static final int[] MARKS = { R.id.qd_q0_mark, R.id.qd_q1_mark, R.id.qd_q2_mark, R.id.qd_q3_mark, R.id.qd_q4_mark };
    private static final int[] TITLES = { R.id.qd_q0_title, R.id.qd_q1_title, R.id.qd_q2_title, R.id.qd_q3_title, R.id.qd_q4_title };
    private static final int[] BTNS = { R.id.qd_q0_btn, R.id.qd_q1_btn, R.id.qd_q2_btn, R.id.qd_q3_btn, R.id.qd_q4_btn };

    /** Grand widget : une ligne par quête (✓ faite, ⌛ en attente, ↺ à refaire, ○ à faire). */
    private static void fillRows(Context c, RemoteViews v, JSONArray qs, boolean parent) {
        int n = qs == null ? 0 : Math.min(MAX_ROWS, qs.length());
        for (int i = 0; i < MAX_ROWS; i++) {
            if (i >= n) { v.setViewVisibility(ROWS[i], View.GONE); continue; }
            JSONObject q = qs.optJSONObject(i);
            String st = q.optString("status", "todo");
            v.setViewVisibility(ROWS[i], View.VISIBLE);
            v.setTextViewText(MARKS[i], "done".equals(st) ? "✓" : "pending".equals(st) ? "⌛" : "refused".equals(st) ? "↺" : "○");
            String t = q.optString("title");
            String time = q.optString("time", "");
            v.setTextViewText(TITLES[i], time.isEmpty() || "null".equals(time) ? t : t + " · " + time.replace(":", " h "));
            boolean canDo = !parent && q.optBoolean("trust") && isTodo(st);
            v.setViewVisibility(BTNS[i], canDo ? View.VISIBLE : View.GONE);
            if (canDo) v.setOnClickPendingIntent(BTNS[i], doneIntent(c, q.optString("id")));
        }
    }

    // ---------------- « J'ai fait » sans ouvrir l'appli ----------------

    /** Coche la quête tout de suite sur le widget et la montre, et laisse un message à l'appli pour créditer l'XP. */
    static void markDone(Context c, String missionId) {
        if (missionId == null || missionId.isEmpty()) return;
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONObject d = new JSONObject(p.getString("data", "{}"));
            String today = today();
            JSONArray qs = d.optJSONArray("quests");
            boolean changed = false;
            String nextTitle = "";
            if (qs != null) for (int i = 0; i < qs.length(); i++) {
                JSONObject q = qs.optJSONObject(i);
                if (q == null) continue;
                if (missionId.equals(q.optString("id")) && isTodo(q.optString("status"))) { q.put("status", "done"); changed = true; }
                else if (nextTitle.isEmpty() && isTodo(q.optString("status"))) {
                    String time = q.optString("time", "");
                    nextTitle = q.optString("title") + (time.isEmpty() || "null".equals(time) ? "" : " · " + time.replace(":", " h "));
                }
            }
            if (!changed) return;
            JSONArray days = d.optJSONArray("days");
            if (days != null) for (int i = 0; i < days.length(); i++) {
                JSONObject x = days.optJSONObject(i);
                if (x != null && today.equals(x.optString("date"))) { x.put("done", Math.min(x.optInt("total"), x.optInt("done") + 1)); x.put("next", nextTitle); }
            }
            save(c, d.toString());
            JSONObject payload = new JSONObject().put("missionId", missionId).put("date", today);
            JSONObject msg = LinkProtocol.build(c, LinkStore.deviceId(c), "widget.done", payload.toString(), "", "");
            LinkStore.addInbox(c, msg);
            HomeLinkPlugin.notifyInbox();
        } catch (Exception ignored) { }
    }

    /** Illustration du dragon depuis les fichiers de l'appli, réduite (les widgets ont peu de mémoire). */
    private static Bitmap loadAsset(Context c, String path, int maxW) {
        if (path == null || path.isEmpty()) return null;
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            try (InputStream in = c.getAssets().open("public/" + path)) { BitmapFactory.decodeStream(in, null, o); }
            int sample = 1;
            while (o.outWidth / (sample * 2) >= maxW) sample *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options();
            o2.inSampleSize = sample;
            Bitmap b;
            try (InputStream in = c.getAssets().open("public/" + path)) { b = BitmapFactory.decodeStream(in, null, o2); }
            if (b != null && b.getWidth() > maxW) {
                Bitmap s = Bitmap.createScaledBitmap(b, maxW, Math.max(1, b.getHeight() * maxW / b.getWidth()), true);
                if (s != b) b.recycle();
                b = s;
            }
            return b;
        } catch (Exception e) {
            return null;
        }
    }
}
