package it.carcode.scanner;
import java.io.*;import java.nio.file.*;import java.util.*;
class test_media_cache {
 public static void main(String[] args)throws Exception{
  File dir=Files.createTempDirectory("cccache").toFile();MediaCache c=new MediaCache(dir);byte[] payload=new byte[500000];String first=MediaCache.key("first");c.put(first,payload);new File(dir,first).setLastModified(1L);
  for(int i=0;i<100;i++){String k=MediaCache.key("image"+i);c.put(k,payload);new File(dir,k).setLastModified(1000+i);}
  long size=Arrays.stream(dir.listFiles()).mapToLong(File::length).sum();if(size>30_000_000||c.get(first)!=null||c.get(MediaCache.key("image99"))==null)throw new AssertionError("cache");
  if(c.get("../unsafe")!=null)throw new AssertionError("path");c.put(MediaCache.key("huge"),new byte[600001]);if(c.get(MediaCache.key("huge"))!=null)throw new AssertionError("oversize");
  for(File f:dir.listFiles())f.delete();dir.delete();System.out.println("PASS: native Java cache with 100 images, LRU eviction, 30 MB cap, oversize and path rejection; bytes="+size);
 }
}
