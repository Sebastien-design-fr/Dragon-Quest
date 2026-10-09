package fr.questedudragon.homelink;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Pas du jour, comptés par le capteur de pas du téléphone (aucun réseau, aucun compte).
 * Le capteur donne un total depuis le dernier démarrage du téléphone : on garde la dernière valeur lue
 * et on ajoute l'écart au jour en cours (partagé au prorata du temps quand minuit est passé entre deux lectures).
 * Lectures : à l'ouverture de l'appli, à chaque mise à jour du widget et en continu dans le service maison.
 */
final class StepCounter {
    private StepCounter() {}

    private static final String PREFS = "qd_steps";

    static boolean available(Context c) {
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        return sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    static boolean permitted(Context c) {
        if (Build.VERSION.SDK_INT < 29) return true;
        return c.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
    }

    private static String dayOf(long t) { return new SimpleDateFormat("yyyy-MM-dd", Locale.FRANCE).format(new Date(t)); }

    /** Enregistre une lecture du capteur (total depuis le démarrage du téléphone). */
    static synchronized void record(Context c, float total) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        long lastTs = p.getLong("lastTs", 0);
        float lastTotal = p.getFloat("lastTotal", -1);
        String today = dayOf(now);
        int steps = today.equals(p.getString("day", "")) ? p.getInt("today", 0) : 0;
        if (lastTs > 0 && lastTotal >= 0) {
            float delta = total >= lastTotal ? total - lastTotal : total;   // total plus petit : le téléphone a redémarré
            if (delta < 0) delta = 0;
            if (today.equals(dayOf(lastTs))) {
                steps += Math.round(delta);
            } else {
                Calendar mid = Calendar.getInstance();
                mid.setTimeInMillis(now);
                mid.set(Calendar.HOUR_OF_DAY, 0); mid.set(Calendar.MINUTE, 0); mid.set(Calendar.SECOND, 0); mid.set(Calendar.MILLISECOND, 0);
                double span = Math.max(1, now - lastTs);
                double frac = Math.max(0, Math.min(1, (now - mid.getTimeInMillis()) / span));
                steps = (int) Math.round(delta * frac);
            }
        }
        p.edit().putLong("lastTs", now).putFloat("lastTotal", total).putString("day", today).putInt("today", steps).apply();
    }

    /** Pas comptés aujourd'hui (dernière lecture). */
    static int today(Context c) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return dayOf(System.currentTimeMillis()).equals(p.getString("day", "")) ? p.getInt("today", 0) : 0;
    }

    /** Lit le capteur une fois (au plus ~1,5 s), puis appelle done (sur le fil principal). */
    static void readOnce(Context context, Runnable done) {
        final Context c = context.getApplicationContext();
        final Handler main = new Handler(Looper.getMainLooper());
        if (!available(c) || !permitted(c)) { main.post(done); return; }
        final SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        final Sensor s = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        final boolean[] finished = { false };
        final SensorEventListener[] holder = new SensorEventListener[1];
        final Runnable finish = () -> {
            if (finished[0]) return;
            finished[0] = true;
            try { sm.unregisterListener(holder[0]); } catch (Exception ignored) { }
            done.run();
        };
        holder[0] = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent e) { record(c, e.values[0]); main.post(finish); }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        try { sm.registerListener(holder[0], s, SensorManager.SENSOR_DELAY_NORMAL, 0, main); }
        catch (Exception e) { main.post(finish); return; }
        main.postDelayed(finish, 1500);
    }

    // ---------- Écoute continue (service maison) ----------
    private static SensorEventListener continuous;

    /** Écoute en continu, par lots (économe en batterie) ; sans effet si déjà active ou non autorisée. */
    static synchronized void listen(Context context) {
        final Context c = context.getApplicationContext();
        if (continuous != null || !available(c) || !permitted(c)) return;
        SensorManager sm = (SensorManager) c.getSystemService(Context.SENSOR_SERVICE);
        continuous = new SensorEventListener() {
            @Override public void onSensorChanged(SensorEvent e) { record(c, e.values[0]); }
            @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }
        };
        try { sm.registerListener(continuous, sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER), SensorManager.SENSOR_DELAY_NORMAL, 5 * 60 * 1000 * 1000); }
        catch (Exception e) { continuous = null; }
    }

    static synchronized void stop(Context context) {
        if (continuous == null) return;
        SensorManager sm = (SensorManager) context.getApplicationContext().getSystemService(Context.SENSOR_SERVICE);
        try { sm.unregisterListener(continuous); } catch (Exception ignored) { }
        continuous = null;
    }
}
