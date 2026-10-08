package fr.questedudragon.wear;

import androidx.annotation.NonNull;
import androidx.wear.tiles.TileService;

import com.google.android.gms.wearable.DataEvent;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.WearableListenerService;

/** Reçoit le résumé envoyé par le téléphone et met la tuile à jour. */
public class StatusListener extends WearableListenerService {
    @Override
    public void onDataChanged(@NonNull DataEventBuffer events) {
        for (DataEvent e : events) {
            if (e.getType() != DataEvent.TYPE_CHANGED) continue;
            if (!"/qd/status".equals(e.getDataItem().getUri().getPath())) continue;
            String json = DataMapItem.fromDataItem(e.getDataItem()).getDataMap().getString("json");
            if (json != null) Status.save(getApplicationContext(), json);
        }
        TileService.getUpdater(getApplicationContext()).requestUpdate(DragonTileService.class);
    }
}
