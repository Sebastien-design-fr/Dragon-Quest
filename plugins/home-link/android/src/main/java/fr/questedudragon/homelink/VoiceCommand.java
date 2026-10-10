package fr.questedudragon.homelink;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;

/**
 * Ordres à la voix pour le dragon (« crache du feu ! », « la révérence ! »).
 * Reconnaissance vocale du téléphone, de préférence hors ligne ; une seule écoute courte à la fois,
 * lancée uniquement quand on appuie sur le micro (aucune écoute en arrière-plan).
 */
final class VoiceCommand {
    interface Callback {
        void state(String state, String text, float level);
        void done(ArrayList<String> matches, String error);
    }

    private static SpeechRecognizer current;
    private static boolean finished;

    private VoiceCommand() { }

    static boolean available(Activity a) {
        try { return SpeechRecognizer.isRecognitionAvailable(a); } catch (Exception e) { return false; }
    }

    static void listen(final Activity a, final String lang, final int maxMs, final Callback cb) {
        a.runOnUiThread(() -> {
            stopNow();
            final SpeechRecognizer sr;
            try { sr = SpeechRecognizer.createSpeechRecognizer(a); } catch (Exception e) { cb.done(null, "unavailable"); return; }
            current = sr;
            finished = false;
            final Handler main = new Handler(Looper.getMainLooper());
            final long[] lastLevel = { 0 };
            sr.setRecognitionListener(new RecognitionListener() {
                private void finish(ArrayList<String> m, String err) {
                    if (finished) return;
                    finished = true;
                    cb.done(m, err);
                    main.post(() -> { try { sr.destroy(); } catch (Exception ignored) { } if (current == sr) current = null; });
                }
                @Override public void onReadyForSpeech(Bundle params) { cb.state("ready", null, 0); }
                @Override public void onBeginningOfSpeech() { cb.state("speaking", null, 0); }
                @Override public void onRmsChanged(float rms) {
                    long now = System.currentTimeMillis();
                    if (now - lastLevel[0] > 90) { lastLevel[0] = now; cb.state("level", null, rms); }
                }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { cb.state("thinking", null, 0); }
                @Override public void onError(int error) {
                    String e;
                    switch (error) {
                        case SpeechRecognizer.ERROR_NO_MATCH: case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: e = "nomatch"; break;
                        case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: e = "permission"; break;
                        case SpeechRecognizer.ERROR_NETWORK: case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: case SpeechRecognizer.ERROR_SERVER: e = "network"; break;
                        case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: e = "busy"; break;
                        default: e = "error" + error;
                    }
                    finish(null, e);
                }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> m = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    finish(m != null ? m : new ArrayList<>(), null);
                }
                @Override public void onPartialResults(Bundle partial) {
                    ArrayList<String> m = partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (m != null && !m.isEmpty()) cb.state("partial", m.get(0), 0);
                }
                @Override public void onEvent(int eventType, Bundle params) { }
            });
            Intent it = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            it.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            it.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
            it.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5);
            it.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            it.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
            it.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, a.getPackageName());
            try { sr.startListening(it); } catch (Exception e) { finished = true; cb.done(null, "unavailable"); return; }
            main.postDelayed(() -> { if (!finished && current == sr) { try { sr.stopListening(); } catch (Exception ignored) { } } }, Math.max(2000, maxMs));
        });
    }

    static void stop(Activity a) { if (a != null) a.runOnUiThread(VoiceCommand::stopNow); }

    private static void stopNow() {
        SpeechRecognizer sr = current;
        if (sr == null) return;
        try { sr.stopListening(); } catch (Exception ignored) { }
    }
}
