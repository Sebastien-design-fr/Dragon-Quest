package fr.questedudragon.wear;

import android.content.Context;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.wear.protolayout.ActionBuilders;
import androidx.wear.protolayout.ColorBuilders;
import androidx.wear.protolayout.DimensionBuilders;
import androidx.wear.protolayout.LayoutElementBuilders;
import androidx.wear.protolayout.ModifiersBuilders;
import androidx.wear.protolayout.ResourceBuilders;
import androidx.wear.protolayout.TimelineBuilders;
import androidx.wear.tiles.RequestBuilders;
import androidx.wear.tiles.TileBuilders;
import androidx.wear.tiles.TileService;

import com.google.android.gms.wearable.DataItem;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.Wearable;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

/**
 * Tuile « Quête du Dragon » : anneau des quêtes du jour sur le bord de l'écran,
 * le dragon (au bon stade, la bonne variante), le compteur, la prochaine quête et la série.
 * Toucher la tuile ouvre l'écran détaillé sur la montre.
 */
public class DragonTileService extends TileService {
    private static final String RES_VERSION = "2";
    private static final int GOLD = 0xFFF3A53A, TRACK = 0xFF3A3342, TEXT = 0xFFFFF3DC, MUTED = 0xFFA2988A, STREAK = 0xFFFFB25A;

    @NonNull
    @Override
    protected ListenableFuture<TileBuilders.Tile> onTileRequest(@NonNull RequestBuilders.TileRequest request) {
        Status s = Status.load(this);
        if (!s.known) fetchFromPhone(this);
        LayoutElementBuilders.LayoutElement root = layout(s);
        TileBuilders.Tile tile = new TileBuilders.Tile.Builder()
                .setResourcesVersion(RES_VERSION + "-" + s.variant + "-" + s.stage)
                // nouvelle journée : la tuile se recalcule d'elle-même (le résumé couvre 7 jours)
                .setFreshnessIntervalMillis(30L * 60L * 1000L)
                .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(root))
                .build();
        return Futures.immediateFuture(tile);
    }

    @NonNull
    @Override
    protected ListenableFuture<ResourceBuilders.Resources> onTileResourcesRequest(@NonNull RequestBuilders.ResourcesRequest request) {
        Status s = Status.load(this);
        ResourceBuilders.Resources res = new ResourceBuilders.Resources.Builder()
                .setVersion(request.getVersion())
                .addIdToImageMapping("dragon", new ResourceBuilders.ImageResource.Builder()
                        .setAndroidResourceByResId(new ResourceBuilders.AndroidImageResourceByResId.Builder()
                                .setResourceId(s.imageRes(this)).build())
                        .build())
                .build();
        return Futures.immediateFuture(res);
    }

    private LayoutElementBuilders.LayoutElement layout(Status s) {
        float progress = s.total > 0 ? Math.min(1f, s.done / (float) s.total) : (s.total == 0 ? 1f : 0f);
        // anneau : fond complet puis progression, depuis midi dans le sens des aiguilles d'une montre
        LayoutElementBuilders.Arc track = new LayoutElementBuilders.Arc.Builder()
                .setAnchorAngle(DimensionBuilders.degrees(0))
                .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
                .addContent(new LayoutElementBuilders.ArcLine.Builder()
                        .setLength(DimensionBuilders.degrees(359.9f))
                        .setThickness(DimensionBuilders.dp(7))
                        .setColor(ColorBuilders.argb(TRACK)).build())
                .build();
        LayoutElementBuilders.Arc ring = new LayoutElementBuilders.Arc.Builder()
                .setAnchorAngle(DimensionBuilders.degrees(0))
                .setAnchorType(LayoutElementBuilders.ARC_ANCHOR_START)
                .addContent(new LayoutElementBuilders.ArcLine.Builder()
                        .setLength(DimensionBuilders.degrees(Math.max(0.1f, 359.9f * progress)))
                        .setThickness(DimensionBuilders.dp(7))
                        .setColor(ColorBuilders.argb(GOLD)).build())
                .build();

        String count = !s.known || s.total < 0 ? "—" : s.total == 0 ? "Repos" : (s.done + " / " + s.total);
        LayoutElementBuilders.Column col = new LayoutElementBuilders.Column.Builder()
                .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
                .addContent(text(s.name + (s.streak > 0 ? "  🔥" + s.streak : ""), 13, STREAK, false, 1))
                .addContent(new LayoutElementBuilders.Image.Builder()
                        .setResourceId("dragon")
                        .setWidth(DimensionBuilders.dp(64)).setHeight(DimensionBuilders.dp(64))
                        .setContentScaleMode(LayoutElementBuilders.CONTENT_SCALE_MODE_FIT).build())
                .addContent(text(count, 22, TEXT, true, 1))
                .addContent(text(s.total > 0 && s.done < s.total ? "quêtes" : "", 11, MUTED, false, 1))
                .addContent(new LayoutElementBuilders.Spacer.Builder().setHeight(DimensionBuilders.dp(2)).build())
                .addContent(text(s.message(), 12, TEXT, false, 2))
                .build();

        return new LayoutElementBuilders.Box.Builder()
                .setWidth(DimensionBuilders.expand()).setHeight(DimensionBuilders.expand())
                .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
                .setVerticalAlignment(LayoutElementBuilders.VERTICAL_ALIGN_CENTER)
                .setModifiers(new ModifiersBuilders.Modifiers.Builder()
                        .setClickable(new ModifiersBuilders.Clickable.Builder()
                                .setId("open")
                                .setOnClick(new ActionBuilders.LaunchAction.Builder()
                                        .setAndroidActivity(new ActionBuilders.AndroidActivity.Builder()
                                                .setPackageName(getPackageName())
                                                .setClassName(MainActivity.class.getName()).build())
                                        .build())
                                .build())
                        .build())
                .addContent(track)
                .addContent(ring)
                .addContent(new LayoutElementBuilders.Box.Builder()
                        .setWidth(DimensionBuilders.dp(150))
                        .setHorizontalAlignment(LayoutElementBuilders.HORIZONTAL_ALIGN_CENTER)
                        .addContent(col).build())
                .build();
    }

    private static LayoutElementBuilders.Text text(String t, float sp, int color, boolean bold, int lines) {
        return new LayoutElementBuilders.Text.Builder()
                .setText(t)
                .setMaxLines(lines)
                .setMultilineAlignment(LayoutElementBuilders.TEXT_ALIGN_CENTER)
                .setFontStyle(new LayoutElementBuilders.FontStyle.Builder()
                        .setSize(DimensionBuilders.sp(sp))
                        .setColor(ColorBuilders.argb(color))
                        .setWeight(bold ? LayoutElementBuilders.FONT_WEIGHT_BOLD : LayoutElementBuilders.FONT_WEIGHT_NORMAL)
                        .build())
                .build();
    }

    /** Montre tout juste installée : on récupère le dernier résumé déjà envoyé par le téléphone. */
    static void fetchFromPhone(Context ctx) {
        final Context c = ctx.getApplicationContext();
        try {
            Wearable.getDataClient(c).getDataItems(new Uri.Builder().scheme("wear").authority("*").path("/qd/status").build())
                    .addOnSuccessListener(items -> {
                        boolean got = false;
                        for (DataItem it : items) {
                            String json = DataMapItem.fromDataItem(it).getDataMap().getString("json");
                            if (json != null) { Status.save(c, json); got = true; }
                        }
                        items.release();
                        if (got) TileService.getUpdater(c).requestUpdate(DragonTileService.class);
                    });
        } catch (Exception ignored) { }
    }
}
