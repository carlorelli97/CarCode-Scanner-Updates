package it.carcode.scanner;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import java.io.*;
import java.net.*;
import java.util.Locale;
import java.util.regex.*;

final class ProductMedia {
    private final MediaCache cache;
    ProductMedia(File folder){cache=new MediaCache(folder);cache.trim(MediaCache.LIMIT);}
    private static final String[] PRODUCTS={"amazon.it","amazon.com","amazon.de","amazon.fr","amazon.es","amazon.co.uk","ebay.it","ebay.com","ebay.de","ebay.fr","ebay.es","ebay.co.uk","tiktok.com"};
    private static final String[] IMAGES={"media-amazon.com","ssl-images-amazon.com","ebayimg.com","tiktokcdn.com","tiktokcdn-us.com","tiktokcdn-eu.com","ibytedtos.com","byteoversea.com"};
    static boolean valid(String s,boolean image){try{
        if(s==null||s.length()>(image?1800:1000)||s.matches(".*\\s.*"))return false;
        URI u=new URI(s);String host=u.getHost();if(!"https".equalsIgnoreCase(u.getScheme())||host==null||u.getUserInfo()!=null||(u.getPort()!=-1&&u.getPort()!=443))return false;
        host=host.toLowerCase(Locale.ROOT);for(String domain:image?IMAGES:PRODUCTS)if(host.equals(domain)||host.endsWith("."+domain))return true;
    }catch(Exception ignored){}return false;}
    private static byte[] get(String url,boolean image) throws Exception {
        for(int i=0;i<4;i++){
            if(!valid(url,image))throw new IOException("URL non autorizzato");
            HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();c.setConnectTimeout(4000);c.setReadTimeout(5000);c.setInstanceFollowRedirects(false);c.setRequestProperty("User-Agent","Mozilla/5.0 CarCode/2.4");
            try{
                int status=c.getResponseCode();if(status>=300&&status<400){String location=c.getHeaderField("Location");if(location==null)throw new IOException("Redirect senza destinazione");url=new URL(new URL(url),location).toString();continue;}
                if(status!=200)throw new IOException("HTTP "+status);
                try(InputStream in=c.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){
                    byte[] block=new byte[8192];int n;while((n=in.read(block))!=-1){if(out.size()+n>2_000_000)throw new IOException("Risorsa troppo grande");out.write(block,0,n);}return out.toByteArray();
                }
            }finally{c.disconnect();}
        }throw new IOException("Troppi redirect");
    }
    private static String attr(String tag,String key){Matcher m=Pattern.compile("(?i)\\b"+key+"\\s*=\\s*(['\"])(.*?)\\1").matcher(tag);return m.find()?m.group(2).replace("&amp;","&"):"";}
    static String resolveHtml(String html) {
        Matcher tags=Pattern.compile("(?is)<(?:meta|img)\\b[^>]{1,12000}>").matcher(html);
        String primary="",meta="";
        while(tags.find()){
            String tag=tags.group();
            if(tag.toLowerCase(Locale.ROOT).startsWith("<img") && "landingImage".equalsIgnoreCase(attr(tag,"id"))){
                for(String key:new String[]{"data-old-hires","src"}){String v=attr(tag,key);if(valid(v,true)&&primary.isEmpty())primary=v;}
            }
            String field=attr(tag,"property");if(field.isEmpty())field=attr(tag,"name");
            if(field.equalsIgnoreCase("og:image")||field.equalsIgnoreCase("og:image:secure_url")||field.equalsIgnoreCase("twitter:image")||field.equalsIgnoreCase("twitter:image:src")){
                String v=attr(tag,"content");if(valid(v,true)&&meta.isEmpty())meta=v;
            }
        }
        if(!primary.isEmpty())return primary;if(!meta.isEmpty())return meta;
        Matcher scripts=Pattern.compile("(?is)<script\\b([^>]*)>(.*?)</script\\s*>").matcher(html);
        while(scripts.find())if("application/ld+json".equalsIgnoreCase(attr(scripts.group(1),"type")))try{
            String v=productImage(new org.json.JSONTokener(scripts.group(2)).nextValue(),0);if(valid(v,true))return v;
        }catch(Exception ignored){}
        return "";
    }
    private static String productImage(Object obj,int depth){
        if(depth>12)return "";
        if(obj instanceof org.json.JSONArray){org.json.JSONArray a=(org.json.JSONArray)obj;for(int i=0;i<a.length();i++){String v=productImage(a.opt(i),depth+1);if(!v.isEmpty())return v;}}
        if(obj instanceof org.json.JSONObject){org.json.JSONObject o=(org.json.JSONObject)obj;Object t=o.opt("@type");if("Product".equals(t)||(t instanceof org.json.JSONArray&&t.toString().contains("\"Product\""))){String v=imageValue(o.opt("image"),0);if(!v.isEmpty())return v;}java.util.Iterator<String> keys=o.keys();while(keys.hasNext()){String v=productImage(o.opt(keys.next()),depth+1);if(!v.isEmpty())return v;}}
        return "";
    }
    private static String imageValue(Object obj,int depth){if(depth>5)return "";if(obj instanceof String&&valid((String)obj,true))return (String)obj;if(obj instanceof org.json.JSONArray){org.json.JSONArray a=(org.json.JSONArray)obj;for(int i=0;i<a.length();i++){String v=imageValue(a.opt(i),depth+1);if(!v.isEmpty())return v;}}if(obj instanceof org.json.JSONObject){org.json.JSONObject o=(org.json.JSONObject)obj;for(String k:new String[]{"url","contentUrl"}){String v=imageValue(o.opt(k),depth+1);if(!v.isEmpty())return v;}}return "";}
    private static String resolve(String link) throws Exception {return resolveHtml(new String(get(link,false),"UTF-8"));}
    static final class Result {final String image,data;Result(String image,String data){this.image=image;this.data=data;}}
    Result load(String link,String supplied) throws Exception {
        if(!valid(link,false))return new Result("","");
        String id=MediaCache.key(link);byte[] stored=cache.get(id);
        if(stored!=null)try(DataInputStream in=new DataInputStream(new ByteArrayInputStream(stored))){String image=in.readUTF();if(!valid(image,true)||(valid(supplied,true)&&!image.equals(supplied)))throw new IOException("Cache obsoleta");byte[] jpg=new byte[in.available()];in.readFully(jpg);return new Result(image,"data:image/jpeg;base64,"+Base64.encodeToString(jpg,Base64.NO_WRAP));}catch(Exception ignored){}
        String image=valid(supplied,true)?supplied:resolve(link);if(!valid(image,true))return new Result("","");
        byte[] original;try{original=get(image,true);}catch(Exception failure){String fresh=resolve(link);if(!valid(fresh,true)||fresh.equals(image))throw failure;image=fresh;original=get(image,true);}BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(original,0,original.length,o);
        if(o.outWidth<=0||o.outHeight<=0||o.outWidth>16000||o.outHeight>16000)return new Result("","");
        o.inSampleSize=1;while(Math.max(o.outWidth,o.outHeight)/o.inSampleSize>640)o.inSampleSize*=2;o.inJustDecodeBounds=false;
        Bitmap b=BitmapFactory.decodeByteArray(original,0,original.length,o);if(b==null)return new Result("","");
        int max=Math.max(b.getWidth(),b.getHeight());Bitmap small=max>320?Bitmap.createScaledBitmap(b,Math.max(1,b.getWidth()*320/max),Math.max(1,b.getHeight()*320/max),true):b;
        ByteArrayOutputStream jpg=new ByteArrayOutputStream();small.compress(Bitmap.CompressFormat.JPEG,75,jpg);if(small!=b)small.recycle();b.recycle();
        byte[] raw=jpg.toByteArray();ByteArrayOutputStream packed=new ByteArrayOutputStream();try(DataOutputStream out=new DataOutputStream(packed)){out.writeUTF(image);out.write(raw);}cache.put(id,packed.toByteArray());
        return new Result(image,"data:image/jpeg;base64,"+Base64.encodeToString(raw,Base64.NO_WRAP));
    }
}
