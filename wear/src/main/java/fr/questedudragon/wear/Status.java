package fr.questedudragon.wear;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Résumé envoyé par le téléphone (même contenu que le widget) et lecture du jour courant :
 * la montre reste juste après minuit même si le téléphone n'a rien renvoyé.
 */
final class Status {
    static final String PREFS = "qd_status";
    String name = "Ton dragon", sub = "", variant = "dragon", stage = "baby", next = "", status = "", line = "";
    int total = -1, done = 0, streak = 0;
    boolean known = false;

    static void save(Context c, String json) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("json", json).apply();
    }

    static Status load(Context c) {
        Status s = new Status();
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = p.getString("json", null);
        if (json == null) return s;
        try {
            JSONObject d = new JSONObject(json);
            s.known = true;
            s.name = d.optString("name", s.name);
            s.sub = d.optString("sub", "");
            s.variant = d.optString("variant", "dragon");
            s.stage = d.optString("stage", "baby");
            s.streak = d.optInt("streak", 0);
            String today = new SimpleDateFormat("yyyy-MM-dd", Locale.FRANCE).format(new Date());
            boolean fresh = today.equals(d.optString("statusDate"));
            s.status = fresh ? d.optString("status", "") : "";
            s.line = fresh ? d.optString("line", "") : "";
            JSONArray days = d.optJSONArray("days");
            if (days != null) for (int i = 0; i < days.length(); i++) {
                JSONObject x = days.optJSONObject(i);
                if (x != null && today.equals(x.optString("date"))) {
                    s.total = x.optInt("total", 0); s.done = x.optInt("done", 0); s.next = x.optString("next", "");
                    break;
                }
            }
        } catch (Exception ignored) { }
        return s;
    }

    /** Phrase principale : prochaine quête, journée parfaite, repos… */
    String message() {
        if (!known) return "Ouvre Quête du Dragon sur ton téléphone";
        if (!line.isEmpty()) return line;
        if (total < 0) return "Ouvre l’appli sur ton téléphone";
        if (total == 0) return "Pas de quête aujourd’hui";
        if (done >= total) return "Journée parfaite !";
        if (!next.isEmpty()) return next;
        return "En attente des parents";
    }

    int imageRes(Context c) {
        int id = c.getResources().getIdentifier("qd_" + variant + "_" + stage, "drawable", c.getPackageName());
        return id != 0 ? id : R.drawable.qd_dragon_baby;
    }
}
