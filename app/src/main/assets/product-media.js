// Only URLs in state; pictures are transient data from the native 30 MB LRU cache.
let mediaSequence=0; const mediaPending=new Map(); const mediaMemory=new Map();
function mediaKey(p){return JSON.stringify([p.link,p.image||'']);}
function showMedia(n,data){const ph=n.querySelector('.media-photo');ph.textContent=data?'':'Immagine non disponibile';if(data&&data.startsWith('data:image/jpeg;base64,')){const img=document.createElement('img');img.alt='Foto prodotto';img.src=data;img.style.cssText='max-width:100%;max-height:150px;object-fit:contain;border-radius:8px;display:block;margin:8px auto';ph.append(img);}}
function productMediaMarkup(l,id){
 if(!l.link)return '<p class="muted">Inserzione non disponibile</p>';
 const token=String(++mediaSequence);mediaPending.set(token,{id,sku:l.sku,link:l.link,image:l.image||''});
 return '<div class="product-media" data-media-token="'+token+'"><div class="media-photo muted">Immagine in attesa</div><button class="wide" data-product-link="'+esc(token)+'">Apri inserzione</button></div>';
}
function attachProductMedia(){
 const nodes=Array.from(document.querySelectorAll('[data-media-token]'));const alive=new Set(nodes.map(n=>n.dataset.mediaToken));
 for(const token of mediaPending.keys())if(!alive.has(token))mediaPending.delete(token);
 for(const n of nodes){if(n.dataset.bound)continue;n.dataset.bound='1';const token=n.dataset.mediaToken,p=mediaPending.get(token);if(!p)continue;
  n.querySelector('button').onclick=()=>window.CarCodeNative?.openProduct(p.link);
  const load=()=>{if(!n.isConnected)return;const cached=mediaMemory.get(mediaKey(p));if(cached){showMedia(n,cached);return;}const ph=n.querySelector('.media-photo');if(window.CarCodeNative?.loadMedia){ph.textContent='Caricamento…';window.CarCodeNative.loadMedia(token,p.link,p.image);}else ph.textContent='Immagine disponibile nell’app Android';};
  if(window.IntersectionObserver){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}});observer.observe(n);setTimeout(()=>observer.disconnect(),30000);}else load();
 }
}
window.productMediaResult=function(token,image,data){
 const p=mediaPending.get(token);if(!p)return;
 const n=document.querySelector('[data-media-token="'+token+'"]');if(!n)return;
 if(data&&data.length<400000&&data.startsWith('data:image/jpeg;base64,')){mediaMemory.set(mediaKey(p),data);if(image)mediaMemory.set(mediaKey({...p,image}),data);while(mediaMemory.size>6)mediaMemory.delete(mediaMemory.keys().next().value);}
 showMedia(n,data);
 // Send only confirmed metadata, not image bytes or PDF. Exact order and SKU on server.
 const line=state.orders[p.id]?.lines?.find(l=>l.sku===p.sku&&l.link===p.link);
 if(image&&line&&line.image!==image){line.image=image;save();if(config)requestSync('product_media',{id:p.id,sku:p.sku,link:p.link,image}).catch(()=>{if(line.image===image)delete line.image;});}
};
