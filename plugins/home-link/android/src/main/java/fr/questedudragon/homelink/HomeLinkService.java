package fr.questedudragon.homelink;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Service de premier plan qui maintient le lien maison :
 *  - serveur TCP qui reçoit les messages des autres téléphones (même appli fermée) ;
 *  - annonce et découverte des téléphones sur le Wi-Fi (NSD / mDNS) ;
 *  - livraison périodique de la boîte d'envoi ;
 *  - affichage des notifications reçues (avec leurs boutons).
 * Android impose une notification permanente (discrète) pendant que le service tourne.
 */
public class HomeLinkService extends Service {
    static final String SERVICE_TYPE = "_quetedragon._tcp.";
    static final String ACTION_FLUSH = "fr.questedudragon.homelink.FLUSH";

    private static volatile HomeLinkService instance;
    private static volatile int port = 0;

    /** Appareils vus sur le réseau : id -> {host, port, role}. Sert aussi à l'appairage. */
    static final Map<String, JSONObject> resolved = new ConcurrentHashMap<>();

    private ServerSocket server;
    private ScheduledExecutorService scheduler;
    private ExecutorService workers;
    private NsdManager nsd;
    private NsdManager.RegistrationListener registration;
    private NsdManager.DiscoveryListener discovery;
    private WifiManager.MulticastLock multicastLock;
    private ConnectivityManager.NetworkCallback networkCallback;
    private final ArrayDeque<NsdServiceInfo> resolveQueue = new ArrayDeque<>();
    private boolean resolving = false;

    // ---------------- Démarrage ----------------

    public static void start(Context c) {
        Intent it = new Intent(c, HomeLinkService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(it);
            else c.startService(it);
        } catch (Exception e) {
            // Démarrage refusé en arrière-plan : il sera relancé à la prochaine ouverture de l'appli.
        }
    }

    public static void stop(Context c) {
        c.stopService(new Intent(c, HomeLinkService.class));
    }

    public static boolean running() { return instance != null; }

    public static int currentPort() { return port; }

    public static void requestFlush(Context c) {
        HomeLinkService s = instance;
        if (s != null && s.scheduler != null) s.scheduler.execute(s::flushNow);
        else if (LinkStore.isPaired(c)) start(c);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        LinkNotifications.ensureChannels(this);
        goForeground();
        scheduler = Executors.newSingleThreadScheduledExecutor();
        workers = Executors.newCachedThreadPool();
        acquireMulticast();
        startServer();
        startNsd();
        watchNetwork();
        scheduler.scheduleWithFixedDelay(this::flushNow, 2, 30, TimeUnit.SECONDS);
        // pas du jour : écoute continue du capteur (dès que l'autorisation est donnée)
        scheduler.scheduleWithFixedDelay(() -> StepCounter.listen(this), 3, 600, TimeUnit.SECONDS);
    }

    private void goForeground() {
        Notification n = LinkNotifications.serviceNotification(this, LinkStore.peers(this).length());
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(LinkNotifications.SERVICE_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(LinkNotifications.SERVICE_ID, n);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (scheduler != null) scheduler.execute(this::flushNow);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        instance = null;
        StepCounter.stop(this);
        NearbyLink.stop(this);
        try { if (server != null) server.close(); } catch (Exception ignored) {}
        stopNsd();
        if (networkCallback != null) {
            try { getSystemService(ConnectivityManager.class).unregisterNetworkCallback(networkCallback); } catch (Exception ignored) {}
        }
        if (multicastLock != null && multicastLock.isHeld()) multicastLock.release();
        if (scheduler != null) scheduler.shutdownNow();
        if (workers != null) workers.shutdownNow();
        port = 0;
        super.onDestroy();
    }

    // ---------------- Livraison ----------------

    private void flushNow() {
        try {
            if (!LinkStore.isPaired(this)) return;
            LinkProtocol.flush(this);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(LinkNotifications.SERVICE_ID, LinkNotifications.serviceNotification(this, recentPeers()));
        } catch (Exception ignored) {}
    }

    private int recentPeers() {
        JSONObject peers = LinkStore.peers(this);
        long now = System.currentTimeMillis();
        int n = 0;
        java.util.Iterator<String> it = peers.keys();
        while (it.hasNext()) {
            JSONObject p = peers.optJSONObject(it.next());
            if (p != null && now - p.optLong("lastSeen") < 10 * 60 * 1000) n++;
        }
        return n;
    }

    // ---------------- Serveur ----------------

    private void startServer() {
        try {
            server = new ServerSocket(0);
            port = server.getLocalPort();
        } catch (Exception e) {
            return;
        }
        Thread t = new Thread(() -> {
            while (server != null && !server.isClosed()) {
                try {
                    Socket s = server.accept();
                    workers.execute(() -> handle(s));
                } catch (Exception e) {
                    if (server == null || server.isClosed()) break;
                }
            }
        }, "home-link-server");
        t.setDaemon(true);
        t.start();
    }

    private void handle(Socket s) {
        try (Socket socket = s) {
            socket.setSoTimeout(LinkProtocol.READ_TIMEOUT_MS);
            BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8));
            String line = in.readLine();
            String remote = socket.getInetAddress() != null ? socket.getInetAddress().getHostAddress() : "";
            String reply = line == null ? "ERR" : process(line, remote);
            OutputStream out = socket.getOutputStream();
            out.write((reply + "\n").getBytes(StandardCharsets.UTF_8));
            out.flush();
        } catch (Exception ignored) {}
    }

    private String process(String line, String remote) {
        JSONObject m;
        try { m = new JSONObject(line); } catch (Exception e) { return "ERR"; }
        if (m.has("pair")) return Pairing.handle(this, m.optJSONObject("pair"), remote).toString();
        return receive(this, m, remote);
    }

    /**
     * Message reçu d'un autre téléphone de la famille (Wi-Fi de la maison ou Bluetooth en sortie) :
     * vérifié, rangé dans la boîte de réception, notification affichée. remote = adresse IP (null en Bluetooth).
     */
    static String receive(Context c, JSONObject m, String remote) {
        if (!LinkProtocol.verify(c, m)) return "ERR";
        String from = m.optString("from");
        LinkStore.upsertPeer(c, from, m.optString("fromName"), m.optString("role"), remote, remote == null ? 0 : m.optInt("port"));
        if (LinkStore.addInbox(c, m)) {
            if ("family.members".equals(m.optString("type"))) applyMembers(c, m.optString("payload"));
            String dismiss = m.optString("dismiss");
            if (!dismiss.isEmpty()) LinkNotifications.cancel(c, dismiss);
            String notif = m.optString("notif");
            if (!notif.isEmpty()) {
                try { LinkNotifications.show(c, new JSONObject(notif), from); } catch (Exception ignored) {}
            }
            HomeLinkPlugin.notifyInbox();
        }
        return "OK " + m.optString("id");
    }

    /** Liste des membres diffusée par le parent qui a accueilli un nouvel appareil. */
    static void applyMembers(Context c, String payload) {
        try {
            JSONArray members = new JSONObject(payload).optJSONArray("members");
            if (members == null) return;
            for (int i = 0; i < members.length(); i++) {
                JSONObject p = members.optJSONObject(i);
                if (p == null) continue;
                LinkStore.upsertPeer(c, p.optString("id"), p.optString("name"), p.optString("role"), p.optString("host"), p.optInt("port"));
            }
        } catch (Exception ignored) {}
    }

    // ---------------- Découverte (NSD) ----------------

    private void acquireMulticast() {
        try {
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi == null) return;
            multicastLock = wifi.createMulticastLock("home-link");
            multicastLock.setReferenceCounted(false);
            multicastLock.acquire();
        } catch (Exception ignored) {}
    }

    private void watchNetwork() {
        if (Build.VERSION.SDK_INT < 24) return;
        try {
            ConnectivityManager cm = getSystemService(ConnectivityManager.class);
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override public void onAvailable(Network network) {
                    if (scheduler != null) scheduler.schedule(() -> { restartNsd(); flushNow(); }, 2, TimeUnit.SECONDS);
                }
            };
            cm.registerDefaultNetworkCallback(networkCallback);
        } catch (Exception ignored) {}
    }

    void restartNsd() { stopNsd(); startNsd(); }

    private void startNsd() {
        nsd = (NsdManager) getSystemService(Context.NSD_SERVICE);
        if (nsd == null) return;
        registerSelf();
        discovery = new NsdManager.DiscoveryListener() {
            @Override public void onStartDiscoveryFailed(String t, int e) {}
            @Override public void onStopDiscoveryFailed(String t, int e) {}
            @Override public void onDiscoveryStarted(String t) {}
            @Override public void onDiscoveryStopped(String t) {}
            @Override public void onServiceFound(NsdServiceInfo info) { queueResolve(info); }
            @Override public void onServiceLost(NsdServiceInfo info) {}
        };
        try { nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discovery); } catch (Exception ignored) {}
    }

    /** Annonce ce téléphone sur le réseau (uniquement une fois rattaché à une famille). */
    void registerSelf() {
        if (nsd == null || port <= 0 || !LinkStore.isPaired(this)) return;
        if (registration != null) { try { nsd.unregisterService(registration); } catch (Exception ignored) {} }
        JSONObject cfg = LinkStore.config(this);
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName("QD-" + cfg.optString("deviceId"));
        info.setServiceType(SERVICE_TYPE);
        info.setPort(port);
        info.setAttribute("id", cfg.optString("deviceId"));
        info.setAttribute("role", cfg.optString("role"));
        registration = new NsdManager.RegistrationListener() {
            @Override public void onRegistrationFailed(NsdServiceInfo s, int e) {}
            @Override public void onUnregistrationFailed(NsdServiceInfo s, int e) {}
            @Override public void onServiceRegistered(NsdServiceInfo s) {}
            @Override public void onServiceUnregistered(NsdServiceInfo s) {}
        };
        try { nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, registration); } catch (Exception ignored) {}
    }

    private void stopNsd() {
        if (nsd == null) return;
        try { if (discovery != null) nsd.stopServiceDiscovery(discovery); } catch (Exception ignored) {}
        try { if (registration != null) nsd.unregisterService(registration); } catch (Exception ignored) {}
        discovery = null;
        registration = null;
    }

    private synchronized void queueResolve(NsdServiceInfo info) {
        String self = "QD-" + LinkStore.deviceId(this);
        if (self.equals(info.getServiceName())) return;
        resolveQueue.add(info);
        resolveNext();
    }

    @SuppressWarnings("deprecation")
    private synchronized void resolveNext() {
        if (resolving || nsd == null) return;
        NsdServiceInfo next = resolveQueue.poll();
        if (next == null) return;
        resolving = true;
        try {
            nsd.resolveService(next, new NsdManager.ResolveListener() {
                @Override public void onResolveFailed(NsdServiceInfo s, int error) {
                    synchronized (HomeLinkService.this) { resolving = false; }
                    if (error == NsdManager.FAILURE_ALREADY_ACTIVE && scheduler != null) {
                        scheduler.schedule(() -> queueResolve(s), 1, TimeUnit.SECONDS);
                    }
                    resolveNext();
                }
                @Override public void onServiceResolved(NsdServiceInfo s) {
                    synchronized (HomeLinkService.this) { resolving = false; }
                    onResolved(s);
                    resolveNext();
                }
            });
        } catch (Exception e) {
            resolving = false;
        }
    }

    @SuppressWarnings("deprecation")
    private void onResolved(NsdServiceInfo s) {
        try {
            InetAddress host = s.getHost();
            if (host == null) return;
            String id = attr(s, "id");
            if (id.isEmpty()) {
                String name = s.getServiceName();
                id = name != null && name.startsWith("QD-") ? name.substring(3) : "";
            }
            if (id.isEmpty() || id.equals(LinkStore.deviceId(this))) return;
            JSONObject entry = new JSONObject().put("host", host.getHostAddress()).put("port", s.getPort()).put("role", attr(s, "role"));
            resolved.put(id, entry);
            if (LinkStore.peers(this).has(id)) {
                LinkStore.upsertPeer(this, id, null, null, host.getHostAddress(), s.getPort());
                if (scheduler != null) scheduler.execute(this::flushNow);
            }
        } catch (Exception ignored) {}
    }

    private static String attr(NsdServiceInfo s, String key) {
        try {
            byte[] v = s.getAttributes().get(key);
            return v == null ? "" : new String(v, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    static HomeLinkService get() { return instance; }
}
