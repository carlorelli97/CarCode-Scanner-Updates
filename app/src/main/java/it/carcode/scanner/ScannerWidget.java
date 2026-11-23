package it.carcode.scanner;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class ScannerWidget extends AppWidgetProvider {
    static SharedPreferences prefs(Context c){return c.getSharedPreferences("widget_status",Context.MODE_PRIVATE);}
    private static int id(Context c,String n){return c.getResources().getIdentifier(n,"id",c.getPackageName());}
    private static PendingIntent click(Context c,String action,int code){
        Intent i=new Intent(c,MainActivity.class).setAction("it.carcode.scanner.widget."+action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c,code,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    public static void save(Context c,int open,int done,long stamp){
        prefs(c).edit().putInt("open",Math.max(0,open)).putInt("done",Math.max(0,done)).putLong("stamp",stamp).apply();
        AppWidgetManager m=AppWidgetManager.getInstance(c);for(int w:m.getAppWidgetIds(new ComponentName(c,ScannerWidget.class)))update(c,m,w);
    }
    @Override public void onUpdate(Context c,AppWidgetManager m,int[] ids){for(int w:ids)update(c,m,w);}
    private static void update(Context c,AppWidgetManager m,int widget){
        SharedPreferences p=prefs(c);RemoteViews v=new RemoteViews(c.getPackageName(),c.getResources().getIdentifier("scanner_widget","layout",c.getPackageName()));
        int open=p.getInt("open",-1),done=p.getInt("done",-1);long stamp=p.getLong("stamp",0);
        v.setTextViewText(id(c,"widget_open"),(open<0?"—":String.valueOf(open))+"\nDa preparare");
        v.setTextViewText(id(c,"widget_done"),(done<0?"—":String.valueOf(done))+"\nCompletati");
        v.setTextViewText(id(c,"widget_stamp"),stamp==0?"Apri app per aggiornare":"Dati app: "+new SimpleDateFormat("dd/MM HH:mm",Locale.ITALY).format(new Date(stamp)));
        v.setOnClickPendingIntent(id(c,"widget_open"),click(c,"orders",1));v.setOnClickPendingIntent(id(c,"widget_done"),click(c,"history",2));
        v.setOnClickPendingIntent(id(c,"widget_scan"),click(c,"scan",3));v.setOnClickPendingIntent(id(c,"widget_search"),click(c,"search",4));v.setOnClickPendingIntent(id(c,"widget_title"),click(c,"search",5));m.updateAppWidget(widget,v);
    }
}
