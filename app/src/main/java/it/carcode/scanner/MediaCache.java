package it.carcode.scanner;
import java.io.*;
import java.util.*;
import java.security.MessageDigest;

/** Dedicated bounded thumbnail cache. Never touches orders or other app files. */
final class MediaCache {
    static final long LIMIT=30_000_000L;
    final File dir;
    MediaCache(File dir) { this.dir=dir;dir.mkdirs(); }
    static String key(String url) throws Exception {
        byte[] hash=MessageDigest.getInstance("SHA-256").digest(url.getBytes("UTF-8"));
        StringBuilder b=new StringBuilder();for(byte x:hash)b.append(String.format(Locale.ROOT,"%02x",x&255));return b.toString();
    }
    private File[] files(){File[] f=dir.listFiles();return f==null?new File[0]:f;}
    synchronized void trim(long allowance){
        File[] files=files();long bytes=0;
        for(File f:files)if(f.isFile())bytes+=f.length();
        Arrays.sort(files,(a,b)->Long.compare(a.lastModified(),b.lastModified()));
        for(File f:files)if(bytes>allowance&&f.isFile()){long n=f.length();if(f.delete())bytes-=n;}
    }
    synchronized byte[] get(String id) throws IOException {
        if(!id.matches("[a-f0-9]{64}"))return null;
        File f=new File(dir,id);if(!f.isFile()||f.length()>600_000)return null;
        byte[] raw=new byte[(int)f.length()];try(DataInputStream in=new DataInputStream(new FileInputStream(f))){in.readFully(raw);}f.setLastModified(System.currentTimeMillis());return raw;
    }
    synchronized void put(String id,byte[] value) throws IOException {
        if(!id.matches("[a-f0-9]{64}")||value.length>600_000)return;
        File f=new File(dir,id);if(f.exists())f.delete();trim(LIMIT-value.length);
        long total=0;for(File x:files())if(x.isFile())total+=x.length();if(total+value.length>LIMIT)return;
        try(FileOutputStream out=new FileOutputStream(f)){out.write(value);}catch(IOException ex){f.delete();throw ex;}
    }
}
