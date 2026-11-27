package it.carcode.scanner;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.widget.*;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class LicenseGate {
    final MainActivity host; final CompanyLicense client; final String version; final FrameLayout root;
    final LinearLayout panel; final TextView status; final EditText otp; final Button activate,retry;
    final Handler timer=new Handler(Looper.getMainLooper()); final ExecutorService worker=Executors.newSingleThreadExecutor();
    volatile boolean allowed=false; volatile long deadline=0; boolean busy=false,closed=false,started=false; long nextCheck=0;
    private final Runnable tick=new Runnable(){public void run(){if(closed)return;if(allowed&&SystemClock.elapsedRealtime()>=deadline)block("Verifica licenza necessaria. I dati restano salvati.");if(client.associated()&&!busy&&SystemClock.elapsedRealtime()>=nextCheck)verify();timer.postDelayed(this,5000);}};
    LicenseGate(MainActivity a,FrameLayout r,String v){host=a;root=r;version=v;client=new CompanyLicense(a);
        ScrollView scroll=new ScrollView(a);scroll.setFillViewport(true);panel=new LinearLayout(a);panel.setOrientation(LinearLayout.VERTICAL);panel.setGravity(android.view.Gravity.CENTER_VERTICAL);panel.setPadding(32,32,32,32);panel.setBackgroundColor(0xff0b1525);scroll.addView(panel);root.addView(scroll,new FrameLayout.LayoutParams(-1,-1));
        TextView title=new TextView(a);title.setText("CarCode Scanner\nLicenza aziendale");title.setTextColor(0xfff5f8fd);title.setTextSize(26);panel.addView(title);
        TextView id=new TextView(a);id.setText("ID palmare: "+client.device);id.setTextColor(0xffa6b9d0);id.setTextIsSelectable(true);panel.addView(id);
        Button share=new Button(a);share.setText("Condividi ID palmare");panel.addView(share);share.setOnClickListener(w->a.startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,client.device),"Condividi ID")));
        otp=new EditText(a);otp.setHint("OTP a 6 cifre da CarCode+ Windows");otp.setSingleLine(true);otp.setInputType(2);otp.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(6)});otp.setTextColor(-1);otp.setHintTextColor(0xffa6b9d0);panel.addView(otp);
        activate=new Button(a);activate.setText("Associa palmare");panel.addView(activate);activate.setOnClickListener(w->submit());
        retry=new Button(a);retry.setText("Verifica licenza / riprova");panel.addView(retry);retry.setOnClickListener(w->verify());
        Button reset=new Button(a);reset.setText("Nuova associazione");panel.addView(reset);reset.setOnClickListener(w->new AlertDialog.Builder(a).setTitle("Nuova associazione").setMessage("Usa questa opzione solo dopo che l’azienda ha revocato il palmare. Gli ordini locali non vengono cancellati.").setNegativeButton("Annulla",null).setPositiveButton("Conferma",(d,k)->{if(!busy){client.clear();block("Inserisci il nuovo OTP.");}}).show());
        status=new TextView(a);status.setTextColor(0xffa6b9d0);status.setTextSize(15);panel.addView(status);updateFields();
        block(client.associated()?"Verifica licenza…":"Genera l’OTP dal programma Windows aziendale.");
    }
    private void updateFields(){boolean associated=client.associated();otp.setVisibility(associated?View.GONE:View.VISIBLE);activate.setVisibility(associated?View.GONE:View.VISIBLE);retry.setVisibility(associated?View.VISIBLE:View.GONE);activate.setEnabled(!busy);retry.setEnabled(!busy);}
    void start(){if(client.associated())verify();timer.postDelayed(tick,5000);}
    boolean usable(){return allowed&&SystemClock.elapsedRealtime()<deadline;}
    void resume(){if(allowed&&!usable())block("Verifica licenza necessaria. I dati restano salvati.");if(client.associated()&&!busy&&(!usable()||deadline-SystemClock.elapsedRealtime()<60000))verify();}
    private void submit(){String code=otp.getText().toString();if(!code.matches("[0-9]{6}")){status.setText("Inserisci sei cifre.");return;}run(true,code);}
    void verify(){if(client.associated())run(false,null);}
    private void run(boolean pair,String code){if(busy||closed)return;busy=true;nextCheck=SystemClock.elapsedRealtime()+60000;updateFields();if(!allowed)status.setText("Controllo in corso…");worker.execute(()->{
        JSONObject r=null;String error=null;try{if(pair){JSONObject a=client.call("scanner_associa",version,code);if(!a.optBoolean("ok"))throw new IllegalStateException(a.optString("errore","OTP non accettato"));client.save(a);}r=client.call("scanner_verifica",version,null);}catch(Exception e){error=pair&&e instanceof IllegalStateException?e.getMessage():"Connessione o verifica non riuscita. Riprova.";}
        final JSONObject reply=r;final String err=error;host.runOnUiThread(()->{if(closed)return;busy=false;updateFields();if(err!=null){if(!usable())block(err);return;}if(reply!=null&&reply.optBoolean("ok")&&reply.optBoolean("attiva")){long valid=reply.optLong("validForMs",0);if(valid<=0){block("Server licenze da aggiornare.");return;}deadline=SystemClock.elapsedRealtime()+Math.min(120000,valid);allowed=true;((View)panel.getParent()).setVisibility(View.GONE);if(!started){started=true;host.startLicensedWeb();}host.licenseVisible(true);}else if(reply!=null&&reply.optBoolean("ok")){block("Licenza aziendale non attiva oppure palmare revocato. Contatta l’azienda.");}else if(!usable())block("Servizio licenze non disponibile. Riprova.");});
    });}
    void block(String message){allowed=false;deadline=0;((View)panel.getParent()).setVisibility(View.VISIBLE);status.setText(message);updateFields();host.licenseVisible(false);ScannerActivity.showResults();}
    void destroy(){closed=true;timer.removeCallbacksAndMessages(null);worker.shutdownNow();}
}
