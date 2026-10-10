package fr.questedudragon.homelink;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Pont entre l'appli (JavaScript) et le lien maison natif.
 * L'appli décide du contenu des messages ; le natif les signe, les livre et affiche les notifications.
 */
@CapacitorPlugin(name = "HomeLink")
public class HomeLinkPlugin extends Plugin {
    private static volatile HomeLinkPlugin current;

    @Override
    public void load() {
        current = this;
        if (LinkStore.isPaired(getContext())) HomeLinkService.start(getContext());
        try { capture(getActivity().getIntent(), false); } catch (Exception ignored) { }
        // Taille du texte fixe : sinon la police agrandie du téléphone fait déborder et se chevaucher les textes de l'appli.
        try { getBridge().getWebView().getSettings().setTextZoom(100); } catch (Exception ignored) { }
        NearbyLink.update(getContext());
    }

    // ---------- Sortie en famille (Bluetooth) ----------
    @PluginMethod
    public void nearbyState(PluginCall call) {
        Context c = ctx();
        JSObject res = new JSObject();
        res.put("permission", NearbyLink.permitted(c));
        res.put("outing", NearbyLink.outing(c));
        res.put("until", NearbyLink.outingUntil(c));
        res.put("running", NearbyLink.running());
        JSArray peers = new JSArray();
        for (String p : NearbyLink.connectedPeers()) peers.put(p);
        res.put("connected", peers);
        call.resolve(res);
    }

    @PluginMethod
    public void setOuting(PluginCall call) {
        NearbyLink.setOuting(ctx(), Boolean.TRUE.equals(call.getBoolean("on", false)));
        nearbyState(call);
    }

    @PluginMethod
    public void requestNearbyPermission(PluginCall call) {
        try {
            if (!NearbyLink.permitted(ctx()) && getActivity() != null)
                androidx.core.app.ActivityCompat.requestPermissions(getActivity(), NearbyLink.permissions(), 7303);
        } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void takeMeets(PluginCall call) {
        JSObject res = new JSObject();
        res.put("meets", NearbyLink.takeMeets(ctx()));
        call.resolve(res);
    }

    // ---------- Actions lancées depuis le widget (ouvrir les quêtes, caresser, valider…) ----------
    static final String EXTRA_OPEN = "qd_open";
    private static volatile String pendingAction;

    private void capture(Intent it, boolean live) {
        if (it == null) return;
        String a = it.getStringExtra(EXTRA_OPEN);
        if (a == null || a.isEmpty()) return;
        it.removeExtra(EXTRA_OPEN);
        if (live) { pendingAction = null; notifyListeners("launchAction", new JSObject().put("action", a)); }
        else pendingAction = a;
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        capture(intent, true);
    }

    @PluginMethod
    public void takeLaunchAction(PluginCall call) {
        JSObject res = new JSObject();
        if (pendingAction != null) res.put("action", pendingAction);
        pendingAction = null;
        call.resolve(res);
    }

    // ---------- Ordres à la voix ----------
    @PluginMethod
    public void listen(final PluginCall call) {
        final android.app.Activity a = getActivity();
        if (a == null) { call.resolve(new JSObject().put("error", "unavailable")); return; }
        if (androidx.core.content.ContextCompat.checkSelfPermission(ctx(), android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            try { androidx.core.app.ActivityCompat.requestPermissions(a, new String[] { android.Manifest.permission.RECORD_AUDIO }, 7304); } catch (Exception ignored) { }
            call.resolve(new JSObject().put("error", "permission"));
            return;
        }
        if (!VoiceCommand.available(a)) { call.resolve(new JSObject().put("error", "unavailable")); return; }
        String lang = call.getString("lang", "fr-FR");
        Integer maxMs = call.getInt("maxMs", 6000);
        VoiceCommand.listen(a, lang, maxMs == null ? 6000 : maxMs, new VoiceCommand.Callback() {
            @Override public void state(String state, String text, float level) {
                JSObject e = new JSObject().put("state", state);
                if (text != null) e.put("text", text);
                if ("level".equals(state)) e.put("level", level);
                notifyListeners("speech", e);
            }
            @Override public void done(java.util.ArrayList<String> matches, String error) {
                JSObject res = new JSObject();
                JSArray arr = new JSArray();
                if (matches != null) for (String m : matches) arr.put(m);
                res.put("matches", arr);
                if (error != null) res.put("error", error);
                call.resolve(res);
            }
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        VoiceCommand.stop(getActivity());
        call.resolve();
    }

    // ---------- Pas du jour ----------
    @PluginMethod
    public void getSteps(PluginCall call) {
        final Context c = ctx();
        StepCounter.readOnce(c, () -> {
            JSObject res = new JSObject();
            res.put("available", StepCounter.available(c));
            res.put("permission", StepCounter.permitted(c));
            res.put("today", StepCounter.today(c));
            call.resolve(res);
            if (StepCounter.permitted(c)) StepCounter.listen(c);
        });
    }

    @PluginMethod
    public void requestStepsPermission(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 29 && !StepCounter.permitted(ctx()) && getActivity() != null) {
                androidx.core.app.ActivityCompat.requestPermissions(getActivity(), new String[] { android.Manifest.permission.ACTIVITY_RECOGNITION }, 7302);
            }
        } catch (Exception ignored) { }
        call.resolve();
    }

    /** Rencontre en sortie (Bluetooth) : prévient l'appli ouverte. */
    static void notifyNearby(String peer) {
        HomeLinkPlugin p = current;
        if (p != null) p.notifyListeners("nearby", new JSObject().put("type", "meet").put("peer", peer));
    }

    /** Prévient l'appli ouverte qu'il y a du nouveau dans la boîte de réception. */
    static void notifyInbox() {
        HomeLinkPlugin p = current;
        if (p != null) p.notifyListeners("inbox", new JSObject());
    }

    private Context ctx() { return getContext().getApplicationContext(); }

    @PluginMethod
    public void getState(PluginCall call) {
        Context c = ctx();
        JSONObject cfg = LinkStore.config(c);
        JSObject res = new JSObject();
        res.put("native", true);
        res.put("deviceId", cfg.optString("deviceId"));
        res.put("deviceName", cfg.optString("deviceName"));
        res.put("role", cfg.optString("role"));
        res.put("paired", LinkStore.isPaired(c));
        res.put("running", HomeLinkService.running());
        res.put("outbox", LinkStore.outbox(c).length());
        res.put("batteryExempt", batteryExempt(c));
        JSArray members = new JSArray();
        JSONArray arr = LinkStore.membersArray(c);
        JSONObject peers = LinkStore.peers(c);
        for (int i = 1; i < arr.length(); i++) { // 0 = soi-même
            JSONObject m = arr.optJSONObject(i);
            if (m == null) continue;
            JSONObject p = peers.optJSONObject(m.optString("id"));
            try { m.put("lastSeen", p != null ? p.optLong("lastSeen") : 0); } catch (Exception ignored) {}
            members.put(m);
        }
        res.put("members", members);
        call.resolve(res);
    }

    @PluginMethod
    public void setName(PluginCall call) {
        try {
            JSONObject cfg = LinkStore.config(ctx());
            cfg.put("deviceName", call.getString("name", ""));
            LinkStore.saveConfig(ctx(), cfg);
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void createFamily(PluginCall call) {
        try {
            Context c = ctx();
            JSONObject cfg = LinkStore.config(c);
            cfg.put("deviceName", call.getString("name", cfg.optString("deviceName")));
            cfg.put("role", "parent");
            cfg.put("familyId", LinkStore.randomId(10));
            cfg.put("familyKey", LinkStore.randomKey());
            LinkStore.saveConfig(c, cfg);
            HomeLinkService.start(c);
            HomeLinkService s = HomeLinkService.get();
            if (s != null) s.registerSelf();
            call.resolve(new JSObject().put("familyId", cfg.optString("familyId")));
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void startPairing(PluginCall call) {
        try {
            HomeLinkService.start(ctx());
            JSONObject s = Pairing.open(call.getString("role", "child"));
            call.resolve(JSObject.fromJSONObject(s));
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void stopPairing(PluginCall call) {
        Pairing.close();
        call.resolve();
    }

    @PluginMethod
    public void joinFamily(PluginCall call) {
        final String code = call.getString("code", "");
        final String name = call.getString("name", "");
        final Context c = ctx();
        HomeLinkService.start(c);
        new Thread(() -> {
            try {
                for (int i = 0; i < 30 && HomeLinkService.currentPort() == 0; i++) Thread.sleep(100);
                JSONObject res = Pairing.join(c, code, name);
                HomeLinkService.requestFlush(c);
                call.resolve(JSObject.fromJSONObject(res.put("familyKey", "")));
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void send(PluginCall call) {
        try {
            Context c = ctx();
            JSObject payload = call.getObject("payload", new JSObject());
            JSObject notif = call.getObject("notif", null);
            JSONArray ids = LinkProtocol.enqueue(c, call.getString("to", "parents"), call.getString("type", ""),
                payload.toString(), notif == null ? "" : notif.toString(), call.getString("dismiss", ""), null);
            HomeLinkService.requestFlush(c);
            NearbyLink.flushConnected(c);   // déjà connectés en Bluetooth : livré tout de suite
            NearbyLink.onDemand(c);         // sinon, courte recherche Bluetooth si le Wi-Fi n'a pas suffi
            JSObject res = new JSObject();
            JSArray idList = new JSArray();
            for (int i = 0; i < ids.length(); i++) idList.put(ids.optString(i));
            res.put("ids", idList);
            call.resolve(res);
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void drainInbox(PluginCall call) {
        JSONArray inbox = LinkStore.drainInbox(ctx());
        JSObject res = new JSObject();
        res.put("messages", inbox);
        call.resolve(res);
    }

    @PluginMethod
    public void dismiss(PluginCall call) {
        LinkNotifications.cancel(ctx(), call.getString("tag", ""));
        call.resolve();
    }

    /** Widget d'écran d'accueil : résumé envoyé par l'appli (JSON), affiché même appli fermée. */
    @PluginMethod
    public void updateWidget(PluginCall call) {
        JSObject data = call.getObject("data", new JSObject());
        DragonWidget.save(ctx(), data.toString());
        call.resolve();
    }

    @PluginMethod
    public void startService(PluginCall call) {
        HomeLinkService.start(ctx());
        call.resolve();
    }

    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        try {
            Intent it = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            it.setData(Uri.parse("package:" + getContext().getPackageName()));
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(it);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent it = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(it);
                call.resolve();
            } catch (Exception e2) { call.reject(e2.getMessage()); }
        }
    }

    @PluginMethod
    public void leaveFamily(PluginCall call) {
        Context c = ctx();
        HomeLinkService.stop(c);
        LinkStore.reset(c);
        call.resolve();
    }

    private static boolean batteryExempt(Context c) {
        if (Build.VERSION.SDK_INT < 23) return true;
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName());
    }
}
