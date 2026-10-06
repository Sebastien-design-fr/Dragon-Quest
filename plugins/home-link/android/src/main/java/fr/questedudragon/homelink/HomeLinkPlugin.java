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
