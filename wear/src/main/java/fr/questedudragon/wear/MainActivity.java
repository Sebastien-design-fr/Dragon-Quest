package fr.questedudragon.wear;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Écran ouvert depuis la tuile : le dragon et la journée en un coup d'œil. */
public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        render();
        DragonTileService.fetchFromPhone(this);
    }

    @Override
    protected void onResume() { super.onResume(); render(); }

    private void render() {
        Status s = Status.load(this);
        float d = getResources().getDisplayMetrics().density;
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = (int) (22 * d);
        col.setPadding(pad, (int) (26 * d), pad, (int) (40 * d));
        col.addView(text(s.name, 16, 0xFFF2D48A, true));
        if (!s.sub.isEmpty()) col.addView(text(s.sub, 11, 0xFFA2988A, false));
        ImageView img = new ImageView(this);
        img.setImageResource(s.imageRes(this));
        img.setAdjustViewBounds(true);
        col.addView(img, new LinearLayout.LayoutParams((int) (110 * d), (int) (110 * d)));
        String count = !s.known || s.total < 0 ? "—" : s.total == 0 ? "Jour de repos" : (s.done + " / " + s.total + " quêtes");
        col.addView(text(count, 20, 0xFFFFF3DC, true));
        col.addView(text(s.message(), 13, 0xFFECE4D4, false));
        if (!s.status.isEmpty()) col.addView(text(s.status, 12, 0xFFFFB25A, false));
        if (s.streak > 0) col.addView(text("Série : " + s.streak + " jour" + (s.streak > 1 ? "s" : ""), 12, 0xFFFFB25A, false));
        col.addView(text("Valide tes quêtes sur le téléphone, ou avec « C’est fait ! » dans les rappels.", 10, 0xFFA2988A, false));
        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(Color.BLACK);
        sv.addView(col);
        setContentView(sv);
    }

    private TextView text(String t, float sp, int color, boolean bold) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setGravity(Gravity.CENTER);
        if (bold) v.setTypeface(Typeface.DEFAULT_BOLD);
        v.setPadding(0, (int) (3 * getResources().getDisplayMetrics().density), 0, 0);
        return v;
    }
}
