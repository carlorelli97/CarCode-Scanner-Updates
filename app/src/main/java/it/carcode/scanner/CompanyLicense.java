package it.carcode.scanner;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.json.JSONObject;

final class CompanyLicense {
    private static final String ENDPOINT="https://script.google.com/macros/s/AKfycbzZnQ5HCHPpQOixIWDPla5NHVFiRgRsg-NFN280bYVuwKuW8Frz7WppzE__YT36I6g/exec";
    private static final String ALIAS="carcode.scanner.company.v1";
    private final SharedPreferences prefs;
    final String device;
    CompanyLicense(Context ctx){
        prefs=ctx.getSharedPreferences("company_license_v1",Context.MODE_PRIVATE);
        String d=prefs.getString("device",null);
        if(d==null){d=UUID.randomUUID().toString().replace("-","").toUpperCase(java.util.Locale.ROOT);if(!prefs.edit().putString("device",d).commit())throw new IllegalStateException("ID non salvato");}
        device=d;
    }
    private SecretKey key(boolean create)throws Exception{
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
        if(ks.containsAlias(ALIAS))return (SecretKey)ks.getKey(ALIAS,null);
        if(!create)throw new IllegalStateException("Chiave locale mancante");
        KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        gen.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return gen.generateKey();
    }
    boolean associated(){return prefs.contains("binding");}
    void save(JSONObject r)throws Exception{
        if(!device.equals(r.optString("dispositivo"))||r.optString("id").isEmpty()||r.optString("token").length()!=72)throw new IllegalArgumentException("Risposta non valida");
        JSONObject data=new JSONObject().put("id",r.getString("id")).put("token",r.getString("token"));
        Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key(true));c.updateAAD(device.getBytes(StandardCharsets.UTF_8));
        String value=Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(data.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
        if(!prefs.edit().putString("binding",value).commit())throw new IllegalStateException("Associazione non salvata");
    }
    JSONObject load()throws Exception{
        String[] parts=prefs.getString("binding","").split(":",-1);if(parts.length!=2)throw new IllegalStateException("Associazione assente");
        Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(false),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));c.updateAAD(device.getBytes(StandardCharsets.UTF_8));
        return new JSONObject(new String(c.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));
    }
    void clear(){prefs.edit().remove("binding").commit();}
    JSONObject call(String action,String version,String otp)throws Exception{
        JSONObject d="scanner_verifica".equals(action)?load():new JSONObject();
        d.put("azione",action).put("dispositivo",device).put("versione",version);if(otp!=null)d.put("otp",otp);
        URL url=new URL(ENDPOINT);
        for(int i=0;i<4;i++){
            HttpURLConnection c=(HttpURLConnection)url.openConnection();c.setInstanceFollowRedirects(false);c.setConnectTimeout(12000);c.setReadTimeout(20000);c.setRequestProperty("Accept","application/json");
            try{
                if(i==0){c.setRequestMethod("POST");c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");try(java.io.OutputStream out=c.getOutputStream()){out.write(d.toString().getBytes(StandardCharsets.UTF_8));}}
                int status=c.getResponseCode();if(status==301||status==302||status==303){URL next=new URL(url,c.getHeaderField("Location"));if(!"https".equals(next.getProtocol())||!"script.googleusercontent.com".equals(next.getHost())||(next.getPort()!=-1&&next.getPort()!=443))throw new SecurityException("Reindirizzamento non autorizzato");url=next;continue;}
                if(status!=200)throw new java.io.IOException("HTTP "+status);
                try(java.io.InputStream in=c.getInputStream();java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream()){byte[] buf=new byte[4096];int n;while((n=in.read(buf))!=-1){out.write(buf,0,n);if(out.size()>65536)throw new java.io.IOException("Risposta troppo grande");}return new JSONObject(out.toString("UTF-8"));}
            }finally{c.disconnect();}
        }
        throw new java.io.IOException("Reindirizzamento non riuscito");
    }
}
