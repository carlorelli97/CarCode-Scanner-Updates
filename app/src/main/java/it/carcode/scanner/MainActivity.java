package it.carcode.scanner;

import android.os.Bundle;
import android.webkit.*;
import android.content.Intent;
import android.net.Uri;
import org.json.JSONObject;
import java.net.URL;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import android.app.Activity;
import android.app.AlertDialog;
import android.widget.Toast;
import java.util.concurrent.atomic.AtomicBoolean;

public class MainActivity extends Activity {
    private WebView web;
    private LicenseGate license;
    boolean licensed(){return license!=null&&license.usable();}
    void licenseVisible(boolean active){if(web!=null)web.setVisibility(active?android.view.View.VISIBLE:android.view.View.INVISIBLE);if(active)dispatchWidget();}
    void startLicensedWeb(){web.loadUrl("file:///android_asset/index.html");checkUpdates(false);}
    private ProductMedia media;
    private final java.util.concurrent.ThreadPoolExecutor mediaExecutor=new java.util.concurrent.ThreadPoolExecutor(2,2,0L,java.util.concurrent.TimeUnit.MILLISECONDS,new java.util.concurrent.ArrayBlockingQueue<Runnable>(24));
    private final java.util.concurrent.ExecutorService fullMediaExecutor=new java.util.concurrent.ThreadPoolExecutor(1,1,0L,java.util.concurrent.TimeUnit.MILLISECONDS,new java.util.concurrent.ArrayBlockingQueue<Runnable>(2));
    private ValueCallback<Uri[]> fileCallback;
    private final AtomicBoolean checking = new AtomicBoolean(false);
    private static final String REPO="carlorelli97/CarCode-Scanner-Updates";
    private static final String CURRENT="2.8";
    static java.lang.ref.WeakReference<MainActivity> scannerHost=new java.lang.ref.WeakReference<>(null);
    void continuousCode(String code){if(licensed()&&web!=null&&!isDestroyed())web.evaluateJavascript("window.cameraLookup("+JSONObject.quote(code)+")",null);}
    void refreshWhileScanning(){if(licensed()&&web!=null&&!isDestroyed())web.evaluateJavascript("window.cameraRefresh&&window.cameraRefresh()",null);}
    private boolean webReady=false;
    private String widgetAction;
    private void readWidgetIntent(Intent i){
        String a=i==null?null:i.getAction(),prefix="it.carcode.scanner.widget.";
        if(a!=null&&a.startsWith(prefix)){String x=a.substring(prefix.length());if(x.matches("orders|history|scan|search"))widgetAction=x; i.setAction(null);}
        dispatchWidget();
    }
    private void dispatchWidget(){if(!licensed()||!webReady||widgetAction==null)return;String a=widgetAction;widgetAction=null;web.evaluateJavascript("window.openWidgetAction("+JSONObject.quote(a)+")",null);}
    @Override protected void onNewIntent(Intent i){super.onNewIntent(i);setIntent(i);readWidgetIntent(i);}
    private static final long UPDATE_DAY_MS=24L*60L*60L*1000L;
    private void checkUpdates(boolean manual){
        if(getPackageName().endsWith(".collaudo")){if(manual)Toast.makeText(this,"Build di collaudo: aggiornamenti disattivati",Toast.LENGTH_LONG).show();return;}
        if(!manual&&System.currentTimeMillis()-getPreferences(MODE_PRIVATE).getLong("update_checked_at",0)<UPDATE_DAY_MS)return;
        if(!checking.compareAndSet(false,true))return;
        new Thread(()->{
            try{
                HttpURLConnection c=(HttpURLConnection)new URL("https://api.github.com/repos/"+REPO+"/releases/latest").openConnection();
                c.setConnectTimeout(10000); c.setReadTimeout(15000);
                c.setRequestProperty("Accept","application/vnd.github+json");
                c.setRequestProperty("User-Agent","CarCode-Scanner/"+CURRENT);
                int status=c.getResponseCode();
                if(status==404){c.disconnect();if(manual)runOnUiThread(()->Toast.makeText(this,"Nessuna release pubblicata",Toast.LENGTH_LONG).show());return;}
                if(status!=200){c.disconnect();throw new Exception("HTTP "+status);}
                JSONObject release;
                try(java.io.InputStream in=c.getInputStream();java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){
                    byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){out.write(buf,0,n);if(out.size()>2000000)throw new Exception("Risposta troppo grande");}
                    release=new JSONObject(out.toString("UTF-8"));
                }finally{c.disconnect();}
                if(!manual)getPreferences(MODE_PRIVATE).edit().putLong("update_checked_at",System.currentTimeMillis()).apply();
                String version=release.getString("tag_name").replaceFirst("^[vV]","");
                if(!version.matches("[0-9]+(\\.[0-9]+){1,3}")||!newer(version,CURRENT)){
                    if(manual)runOnUiThread(()->Toast.makeText(this,"CarCode Scanner è aggiornato",Toast.LENGTH_LONG).show());return;
                }
                String assetName="CarCode-Scanner-"+version+".apk", download=null;
                org.json.JSONArray assets=release.optJSONArray("assets");
                if(assets!=null)for(int i=0;i<assets.length();i++){JSONObject a=assets.getJSONObject(i);if(assetName.equals(a.optString("name"))){String u=a.optString("browser_download_url");if(u.equals("https://github.com/"+REPO+"/releases/download/"+release.getString("tag_name")+"/"+assetName))download=u;}}
                if(download==null)throw new Exception("APK non presente nella release");
                final String link=download;
                final String notes=release.optString("body","").trim();
                runOnUiThread(()->{if(isFinishing()||isDestroyed())return;new AlertDialog.Builder(this)
                    .setTitle("Aggiornamento "+version+" disponibile")
                    .setMessage((notes.isEmpty()?"Nuova versione di CarCode Scanner.":notes.substring(0,Math.min(1200,notes.length())))+"\n\nScarica l’APK e conferma l’installazione Android. Le configurazioni resteranno salvate.")
                    .setNegativeButton("Ricordamelo domani",null)
                    .setPositiveButton("Aggiorna ora",(d,w)->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(link)));}catch(Exception e){Toast.makeText(this,"Browser non disponibile",Toast.LENGTH_LONG).show();}}).show();});
            }catch(Exception e){if(manual)runOnUiThread(()->Toast.makeText(this,"Controllo aggiornamenti non riuscito: "+e.getMessage(),Toast.LENGTH_LONG).show());}
            finally{checking.set(false);}
        }).start();
    }
    static boolean newer(String a,String b){
        String[] x=a.split("\\."),y=b.split("\\.");for(int i=0;i<Math.max(x.length,y.length);i++){int p=i<x.length?Integer.parseInt(x[i]):0,q=i<y.length?Integer.parseInt(y[i]):0;if(p!=q)return p>q;}return false;
    }
    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        readWidgetIntent(getIntent());
        media=new ProductMedia(new java.io.File(getCacheDir(),"carcode-product-media"));
        android.widget.FrameLayout root=new android.widget.FrameLayout(this);
        web=new WebView(this);root.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));setContentView(root);
        web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE); web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(true);
        web.setWebViewClient(new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !r.getUrl().toString().startsWith("file:///android_asset/");}});
        web.addJavascriptInterface(new Object(){ @JavascriptInterface public void scan(){runOnUiThread(()->{if(!licensed())return;scannerHost=new java.lang.ref.WeakReference<>(MainActivity.this);web.evaluateJavascript("true",v->startActivityForResult(new Intent(MainActivity.this,ScannerActivity.class).putExtra("continuous","true".equals(v)),101));});}
        @JavascriptInterface public void openProduct(String url){if(ProductMedia.valid(url,false))runOnUiThread(()->{try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception ignored){}});}
        @JavascriptInterface public void loadMedia(String token,String link,String image){queueMedia(token,link,image,false);}
        @JavascriptInterface public void loadFullMedia(String token,String link,String image){queueMedia(token,link,image,true);}
        @JavascriptInterface public void showLookupResults(){runOnUiThread(()->ScannerActivity.showResults());}
        @JavascriptInterface public void cameraFeedback(String message){runOnUiThread(()->ScannerActivity.feedback(message));}
        @JavascriptInterface public void cameraSyncStatus(String message){runOnUiThread(()->ScannerActivity.syncFeedback(message));}
        @JavascriptInterface public void checkUpdates(){MainActivity.this.checkUpdates(true);}
        @JavascriptInterface public void ready(){runOnUiThread(()->{webReady=true;dispatchWidget();});}
        @JavascriptInterface public void widgetStatus(int open,int done,long stamp){runOnUiThread(()->ScannerWidget.save(MainActivity.this,open,done,stamp));}
        @JavascriptInterface public void sync(String endpoint,String body){new Thread(()->{
            String result;
            try{
                if(!licensed())throw new Exception("Licenza non attiva");
                URL url=new URL(endpoint);if(!url.getProtocol().equals("https")||!url.getHost().equals("script.google.com")||!url.getPath().matches("/macros/s/[A-Za-z0-9_-]+/exec"))throw new Exception("URL Google non valido");
                HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setConnectTimeout(15000);c.setReadTimeout(30000);c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(java.io.OutputStream out=c.getOutputStream()){out.write(body.getBytes(StandardCharsets.UTF_8));}try(java.io.InputStream in=c.getInputStream();java.io.ByteArrayOutputStream buffer=new java.io.ByteArrayOutputStream()){byte[] bytes=new byte[4096];int n;while((n=in.read(bytes))!=-1){buffer.write(bytes,0,n);if(buffer.size()>8000000)throw new Exception("Risposta troppo grande");}result=buffer.toString("UTF-8");}finally{c.disconnect();}
            }catch(Exception ex){result="{\"ok\":false,\"error\":"+JSONObject.quote(ex.getMessage())+"}";}
            final String response=result;runOnUiThread(()->web.evaluateJavascript("syncResult("+JSONObject.quote(response)+")",null));
        }).start();}},"CarCodeNative");
        web.setWebChromeClient(new WebChromeClient(){ @Override public boolean onShowFileChooser(WebView w,ValueCallback<Uri[]> callback,FileChooserParams params){ if(fileCallback!=null) fileCallback.onReceiveValue(null); fileCallback=callback; try{startActivityForResult(params.createIntent(),102);return true;}catch(Exception e){fileCallback=null;callback.onReceiveValue(null);return true;} }});
        license=new LicenseGate(this,root,CURRENT);license.start();
    }
    private void queueMedia(String token,String link,String image,boolean full){
        if(token==null||!token.matches("[0-9]{1,16}"))return;
        try{(full?fullMediaExecutor:mediaExecutor).execute(()->{String data="",resolved="",error="";try{ProductMedia.Result r=media.load(link,image,full);data=r.data;resolved=r.image;}catch(Exception ex){error=ex.getMessage()==null?"Download non riuscito":ex.getMessage();}mediaReply(token,resolved,data,error,full);});}
        catch(java.util.concurrent.RejectedExecutionException ex){mediaReply(token,"","","Coda immagini occupata",full);}
    }
    private void mediaReply(String token,String resolved,String data,String error,boolean full){runOnUiThread(()->{if(web!=null&&!isDestroyed())web.evaluateJavascript("window."+(full?"fullMediaResult":"productMediaResult")+"("+JSONObject.quote(token)+","+JSONObject.quote(resolved)+","+JSONObject.quote(data)+","+JSONObject.quote(error)+")",null);});}
    @Override public void onBackPressed(){if(web==null||!licensed()){super.onBackPressed();return;}web.evaluateJavascript("window.handleBack28&&window.handleBack28()",v->{if(!"true".equals(v))super.onBackPressed();});}
    @Override protected void onResume(){super.onResume();if(license!=null)license.resume();}
    @Override protected void onDestroy(){if(license!=null)license.destroy();mediaExecutor.shutdownNow();fullMediaExecutor.shutdownNow();super.onDestroy();}
    @Override protected void onActivityResult(int req,int res,Intent data){super.onActivityResult(req,res,data);if(req==101&&licensed()&&res==RESULT_OK&&data!=null){String code=data.getStringExtra("barcode");if(code!=null)web.evaluateJavascript("receiveScan("+JSONObject.quote(code)+")",null);}else if(req==102&&fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res,data));fileCallback=null;}}
}
