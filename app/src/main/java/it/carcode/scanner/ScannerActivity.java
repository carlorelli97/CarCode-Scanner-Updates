package it.carcode.scanner;
import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.Camera;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.ImageView;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import com.google.zxing.*;
import com.google.zxing.common.HybridBinarizer;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.EnumMap;

@SuppressWarnings("deprecation") public class ScannerActivity extends Activity implements SurfaceHolder.Callback {
    private Camera camera; private SurfaceHolder holder; private final AtomicBoolean busy=new AtomicBoolean(); private volatile boolean complete=false,active=false;
    private final ExecutorService worker=Executors.newSingleThreadExecutor(); private final MultiFormatReader reader=new MultiFormatReader();
    private long lastFrame; private Button flash; private boolean torch,continuous;
    private volatile boolean horizontal=false; private Guide guide; private TextView syncLabel;
    private static final int BG=0xff0b1525,PANEL=0xff16263d,CONTROL=0xff20334d,BLUE=0xff477fea,TEXT=0xfff5f8fd,MUTED=0xffa6b9d0;
    private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private GradientDrawable rounded(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
    private TextView label(String text,int size,int color,boolean bold){TextView t=new TextView(this);t.setText(text);t.setTextSize(size);t.setTextColor(color);if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;}
    private Button action(String text,int color){Button b=new Button(this);b.setText(text);b.setTextColor(TEXT);b.setTextSize(14);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setAllCaps(false);b.setMinHeight(0);b.setMinimumHeight(0);b.setPadding(dp(8),0,dp(8),0);b.setBackground(rounded(color,12));return b;}
    private volatile String lastCode=""; private volatile int misses; private TextView status; private SeekBar zoom;
    private static java.lang.ref.WeakReference<ScannerActivity> screen=new java.lang.ref.WeakReference<>(null);
    private final android.os.Handler timer=new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable refresher=new Runnable(){public void run(){if(!active)return;MainActivity a=MainActivity.scannerHost.get();if(a!=null)a.refreshWhileScanning();timer.postDelayed(this,15000);}};
    static void feedback(String message){ScannerActivity a=screen.get();if(a!=null&&a.active){a.status.setText(message);a.status.setTextColor(message.startsWith("DOPPIO")?0xffff8a93:TEXT);}}
    static void showResults(){ScannerActivity a=screen.get();if(a!=null&&a.active&&!a.isFinishing())a.finish();}
    static void syncFeedback(String message){ScannerActivity a=screen.get();if(a!=null&&a.active)a.syncLabel.setText(message);}
    private class Guide extends View {
        private final Paint p=new Paint(3);
        Guide(){super(ScannerActivity.this);}
        @Override protected void onDraw(Canvas c){float w=getWidth(),h=getHeight(),l=w*(horizontal?.08f:.22f),r=w-l,t=h*(horizontal?.32f:.10f),b=h-t;p.setColor(0x990b1525);c.drawRect(0,0,w,t,p);c.drawRect(0,b,w,h,p);c.drawRect(0,t,l,b,p);c.drawRect(r,t,w,b,p);p.setColor(0xff76a5ff);p.setStrokeWidth(dp(4));p.setStrokeCap(Paint.Cap.ROUND);float k=dp(22);for(float x:new float[]{l,r})for(float y:new float[]{t,b}){c.drawLine(x,y,x+(x==l?k:-k),y,p);c.drawLine(x,y,x,y+(y==t?k:-k),p);}p.setColor(0x9966e1a0);p.setStrokeWidth(dp(2));if(horizontal)c.drawLine(l+k,(t+b)/2,r-k,(t+b)/2,p);else c.drawLine((l+r)/2,t+k,(l+r)/2,b-k,p);}
    }
    @Override public void onCreate(Bundle b){
        super.onCreate(b);continuous=getIntent().getBooleanExtra("continuous",false);screen=new java.lang.ref.WeakReference<>(this); EnumMap<DecodeHintType,Object> hints=new EnumMap<>(DecodeHintType.class);hints.put(DecodeHintType.POSSIBLE_FORMATS,java.util.Arrays.asList(BarcodeFormat.CODE_128,BarcodeFormat.CODE_39,BarcodeFormat.CODE_93,BarcodeFormat.EAN_13,BarcodeFormat.EAN_8,BarcodeFormat.UPC_A,BarcodeFormat.UPC_E,BarcodeFormat.ITF,BarcodeFormat.QR_CODE,BarcodeFormat.DATA_MATRIX,BarcodeFormat.PDF_417));hints.put(DecodeHintType.TRY_HARDER,true);reader.setHints(hints);
        getWindow().setStatusBarColor(BG);getWindow().setNavigationBarColor(BG);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(BG);
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(16),dp(10),dp(16),dp(10));top.setBackgroundColor(PANEL);
        ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.logo);top.addView(logo,new LinearLayout.LayoutParams(dp(44),dp(44)));
        LinearLayout heading=new LinearLayout(this);heading.setOrientation(LinearLayout.VERTICAL);heading.setPadding(dp(12),0,0,0);heading.addView(label("CarCode Scanner",21,TEXT,true));syncLabel=label("Scansione automatica",12,MUTED,false);heading.addView(syncLabel);top.addView(heading,new LinearLayout.LayoutParams(0,-2,1));Button close=action("✕",CONTROL);close.setOnClickListener(v->finish());top.addView(close,new LinearLayout.LayoutParams(dp(44),dp(44)));root.addView(top);
        TextView hint=label(continuous?"SCANSIONE CONTINUA  •  Inquadra il codice":"VERIFICA PACCO  •  Inquadra il codice",12,0xff76a5ff,true);hint.setPadding(dp(16),dp(10),dp(16),dp(10));root.addView(hint);
        FrameLayout frame=new FrameLayout(this);SurfaceView view=new SurfaceView(this);frame.addView(view,new FrameLayout.LayoutParams(-1,-1));guide=new Guide();frame.addView(guide,new FrameLayout.LayoutParams(-1,-1));root.addView(frame,new LinearLayout.LayoutParams(-1,0,1));view.setOnClickListener(v->focus());guide.setOnClickListener(v->focus());
        LinearLayout bar=new LinearLayout(this);bar.setOrientation(LinearLayout.VERTICAL);bar.setPadding(dp(14),dp(12),dp(14),dp(14));bar.setBackgroundColor(BG);
        LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.VERTICAL);card.setBackground(rounded(PANEL,16));card.setPadding(dp(14),dp(10),dp(14),dp(10));card.addView(label("ULTIMA LETTURA",11,MUTED,true));status=label("In attesa di un barcode…",15,TEXT,true);status.setMaxLines(4);card.addView(status);bar.addView(card,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout zoomRow=new LinearLayout(this);zoomRow.setGravity(Gravity.CENTER_VERTICAL);zoomRow.addView(label("−",21,MUTED,true));zoom=new SeekBar(this);zoom.setEnabled(false);zoom.setProgressTintList(ColorStateList.valueOf(BLUE));zoom.setThumbTintList(ColorStateList.valueOf(0xff76a5ff));zoomRow.addView(zoom,new LinearLayout.LayoutParams(0,dp(42),1));zoomRow.addView(label("+",21,MUTED,true));bar.addView(zoomRow);zoom.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){}public void onProgressChanged(SeekBar b,int n,boolean user){if(user&&camera!=null)try{Camera.Parameters p=camera.getParameters();p.setZoom(n);camera.setParameters(p);}catch(Exception ignored){}}});
        LinearLayout controls=new LinearLayout(this);flash=action("Torcia",CONTROL);flash.setOnClickListener(v->toggleTorch());controls.addView(flash,new LinearLayout.LayoutParams(0,dp(44),1));Button rotate=action("Ruota guida",CONTROL);rotate.setOnClickListener(v->{horizontal=!horizontal;guide.invalidate();});LinearLayout.LayoutParams right=new LinearLayout.LayoutParams(0,dp(44),1);right.leftMargin=dp(8);controls.addView(rotate,right);bar.addView(controls);
        Button done=action("Torna agli ordini",BLUE);done.setOnClickListener(v->finish());LinearLayout.LayoutParams doneParams=new LinearLayout.LayoutParams(-1,dp(46));doneParams.topMargin=dp(8);bar.addView(done,doneParams);root.addView(bar);
        setContentView(root);holder=view.getHolder();holder.addCallback(this);if(checkSelfPermission(android.Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{android.Manifest.permission.CAMERA},1);
    }
    @Override public void onRequestPermissionsResult(int req,String[] p,int[] g){super.onRequestPermissionsResult(req,p,g);if(req==1){if(g.length>0&&g[0]==PackageManager.PERMISSION_GRANTED)start();else finish();}}
    private void start(){
        if(camera!=null||holder==null||!holder.getSurface().isValid()||checkSelfPermission(android.Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED||worker.isShutdown())return;
        try{
            camera=Camera.open();Camera.Parameters p=camera.getParameters();java.util.List<String> modes=p.getSupportedFocusModes();
            if(modes!=null){if(modes.contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE))p.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_PICTURE);else if(modes.contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO))p.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO);else if(modes.contains(Camera.Parameters.FOCUS_MODE_AUTO))p.setFocusMode(Camera.Parameters.FOCUS_MODE_AUTO);}
            Camera.Size best=null;double score=Double.MAX_VALUE;java.util.List<Camera.Size> sizes=p.getSupportedPreviewSizes();if(sizes!=null)for(Camera.Size s:sizes){double v=Math.abs(Math.log((double)s.width*s.height/(1280.0*720.0)))+0.4*Math.abs((double)s.width/s.height-16.0/9.0);if(v<score){score=v;best=s;}}
            if(best!=null)p.setPreviewSize(best.width,best.height);try{camera.setParameters(p);}catch(RuntimeException ignored){}
            p=camera.getParameters();Camera.Size s=p.getPreviewSize();final int w=s.width,h=s.height;java.util.List<String> flashes=p.getSupportedFlashModes();flash.setEnabled(flashes!=null&&flashes.contains(Camera.Parameters.FLASH_MODE_TORCH));
            camera.setDisplayOrientation(90);zoom.setEnabled(p.isZoomSupported());if(p.isZoomSupported()){zoom.setMax(p.getMaxZoom());zoom.setProgress(p.getZoom());}
            camera.setPreviewDisplay(holder);active=true;lastFrame=0;timer.removeCallbacks(refresher);timer.post(refresher);
            camera.setPreviewCallback((data,c)->{long now=android.os.SystemClock.elapsedRealtime();if(data==null||data.length<w*h||!active||complete||now-lastFrame<45||!busy.compareAndSet(false,true))return;lastFrame=now;byte[] copy=java.util.Arrays.copyOf(data,w*h);try{worker.execute(()->decode(copy,w,h));}catch(java.util.concurrent.RejectedExecutionException ex){busy.set(false);}});
            camera.startPreview();if(Camera.Parameters.FOCUS_MODE_AUTO.equals(p.getFocusMode()))focus();
        }catch(Exception e){stop();Toast.makeText(this,"Fotocamera non disponibile",Toast.LENGTH_LONG).show();finish();}
    }
    private Result read(byte[] pixels,int w,int h,int x,int y,int cw,int ch){try{return reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(new PlanarYUVLuminanceSource(pixels,w,h,x,y,cw,ch,false))));}catch(ReaderException ex){return null;}finally{reader.reset();}}
    private void decode(byte[] pixels,int w,int h){try{if(!active||complete)return;boolean sideways=horizontal;int x=w*(sideways?32:10)/100,y=h*(sideways?8:22)/100,cw=w-2*x,ch=h-2*y;Result r=read(pixels,w,h,x,y,cw,ch);if(r==null){byte[] rotated=new byte[cw*ch];for(int j=0;j<ch;j++)for(int i=0;i<cw;i++)rotated[i*ch+ch-1-j]=pixels[(y+j)*w+x+i];r=read(rotated,ch,cw,0,0,ch,cw);}if(r==null){if(++misses>=8)lastCode="";return;}misses=0;if(!active||complete)return;final String value=r.getText();if(continuous){if(value.equals(lastCode))return;lastCode=value;runOnUiThread(()->{if(!active)return;status.setTextColor(TEXT);status.setText(value+" · Ricerca…");MainActivity a=MainActivity.scannerHost.get();if(a!=null)a.continuousCode(value);});}else{complete=true;runOnUiThread(()->{if(isFinishing())return;Intent ret=new Intent();ret.putExtra("barcode",value);setResult(RESULT_OK,ret);finish();});}}finally{busy.set(false);}}
    private void focus(){Camera c=camera;if(c==null)return;try{c.cancelAutoFocus();c.autoFocus((ok,cam)->{try{if(cam==camera&&active&&cam.getParameters().getFocusMode().startsWith("continuous"))cam.cancelAutoFocus();}catch(Exception ignored){}});}catch(Exception ignored){}}
    private void toggleTorch(){if(camera==null)return;try{Camera.Parameters p=camera.getParameters();p.setFlashMode(torch?Camera.Parameters.FLASH_MODE_OFF:Camera.Parameters.FLASH_MODE_TORCH);camera.setParameters(p);torch=!torch;flash.setText(torch?"Spegni":"Torcia");}catch(Exception ignored){}}
    private void stop(){active=false;timer.removeCallbacks(refresher);if(camera!=null){camera.setPreviewCallback(null);try{camera.stopPreview();}catch(Exception ignored){}camera.release();camera=null;}torch=false;if(flash!=null)flash.setText("Torcia");}
    public void surfaceCreated(SurfaceHolder h){start();}public void surfaceChanged(SurfaceHolder h,int f,int w,int t){}public void surfaceDestroyed(SurfaceHolder h){stop();}
    @Override protected void onResume(){super.onResume();start();}@Override protected void onPause(){stop();super.onPause();}
    @Override protected void onDestroy(){stop();worker.shutdownNow();super.onDestroy();}
}
