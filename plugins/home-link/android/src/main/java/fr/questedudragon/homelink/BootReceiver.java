package fr.questedudragon.homelink;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Relance l'écoute après un redémarrage du téléphone ou une mise à jour de l'appli. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (LinkStore.isPaired(context)) HomeLinkService.start(context);
    }
}
