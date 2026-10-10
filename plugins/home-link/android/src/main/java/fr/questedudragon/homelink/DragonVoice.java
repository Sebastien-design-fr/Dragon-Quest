package fr.questedudragon.homelink;

import android.content.Context;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * La voix du dragon : synthèse vocale du téléphone (française, hors ligne si la voix est installée),
 * plus grave et un peu plus lente qu'une voix normale. Prévient quand la phrase est finie.
 */
final class DragonVoice {
    interface Done { void done(String id, boolean ok); }

    private static TextToSpeech tts;
    private static boolean ready;
    private static final Map<String, Object[]> pending = new HashMap<>();
    private static Done listener;

    private DragonVoice() { }

    static void speak(Context c, String id, String text, float pitch, float rate, Done cb) {
        listener = cb;
        if (tts == null) {
            tts = new TextToSpeech(c.getApplicationContext(), status -> {
                ready = status == TextToSpeech.SUCCESS;
                if (ready) {
                    try {
                        tts.setLanguage(Locale.FRANCE);
                        // une voix masculine/grave hors ligne si le téléphone en a une
                        Set<Voice> voices = tts.getVoices();
                        Voice best = null;
                        if (voices != null) for (Voice v : voices) {
                            if (v.getLocale() == null || !"fr".equals(v.getLocale().getLanguage())) continue;
                            if (v.isNetworkConnectionRequired()) continue;
                            String n = v.getName().toLowerCase(Locale.ROOT);
                            if (best == null || n.contains("male") && !n.contains("female")) best = v;
                        }
                        if (best != null) tts.setVoice(best);
                    } catch (Exception ignored) { }
                    tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                        @Override public void onStart(String utteranceId) { }
                        @Override public void onDone(String utteranceId) { finish(utteranceId, true); }
                        @Override public void onError(String utteranceId) { finish(utteranceId, false); }
                    });
                    synchronized (pending) {
                        for (Map.Entry<String, Object[]> e : pending.entrySet()) say(e.getKey(), (String) e.getValue()[0], (Float) e.getValue()[1], (Float) e.getValue()[2]);
                        pending.clear();
                    }
                } else {
                    synchronized (pending) { for (String k : pending.keySet()) finish(k, false); pending.clear(); }
                }
            });
        }
        if (!ready) { synchronized (pending) { pending.put(id, new Object[] { text, pitch, rate }); } return; }
        say(id, text, pitch, rate);
    }

    private static void say(String id, String text, float pitch, float rate) {
        try {
            tts.setPitch(pitch);
            tts.setSpeechRate(rate);
            Bundle b = new Bundle();
            b.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
            if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, b, id) != TextToSpeech.SUCCESS) finish(id, false);
        } catch (Exception e) { finish(id, false); }
    }

    private static void finish(String id, boolean ok) {
        Done l = listener;
        if (l != null) l.done(id, ok);
    }

    static void stop() { try { if (tts != null) tts.stop(); } catch (Exception ignored) { } }
}
