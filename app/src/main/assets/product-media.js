// Only URLs in state; pictures are transient data from the native 30 MB LRU cache.
let mediaSequence=0; const mediaPending=new Map(); const mediaMemory=new Map(); const mediaFlights=new Map(), mediaRequests=new Map(), mediaFailures=new Map();
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
  const load=()=>{if(!n.isConnected)return;const cached=mediaMemory.get(mediaKey(p));if(cached){showMedia(n,cached);return;}const ph=n.querySelector('.media-photo');if(window.CarCodeNative?.loadMedia){const key=mediaKey(p);if(mediaFailures.has(key)&&Date.now()-mediaFailures.get(key)<15000){showMedia(n,'');return;}ph.textContent='Caricamento…';if(mediaFlights.has(key))return;mediaFlights.set(key,token);mediaRequests.set(token,p);window.CarCodeNative.loadMedia(token,p.link,p.image);}else ph.textContent='Immagine disponibile nell’app Android';};
  if(window.IntersectionObserver){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load();}});observer.observe(n);setTimeout(()=>observer.disconnect(),30000);}else load();
 }
}
window.productMediaResult=function(token,image,data){
 const p=mediaRequests.get(token)||mediaPending.get(token);if(!p)return;
 const key=mediaKey(p);mediaRequests.delete(token);if(mediaFlights.get(key)===token)mediaFlights.delete(key);
 const ok=!!(data&&data.length<400000&&data.startsWith('data:image/jpeg;base64,'));
 if(ok){mediaFailures.delete(key);mediaMemory.set(key,data);if(image)mediaMemory.set(mediaKey({...p,image}),data);while(mediaMemory.size>6)mediaMemory.delete(mediaMemory.keys().next().value);}
 else{mediaFailures.set(key,Date.now());while(mediaFailures.size>100)mediaFailures.delete(mediaFailures.keys().next().value);}
 // A scan can redraw the screen while a thumbnail is loading. Reuse the result for the new DOM.
 const targets=[p];for(const [t,entry] of mediaPending){if(mediaKey(entry)!==key)continue;const n=document.querySelector('[data-media-token="'+t+'"]');if(n){showMedia(n,ok?data:'');targets.push(entry);}}
 const visited=new Set();for(const entry of targets){const id=JSON.stringify([entry.id,entry.sku,entry.link]);if(visited.has(id))continue;visited.add(id);const line=state.orders[entry.id]?.lines?.find(l=>l.sku===entry.sku&&l.link===entry.link);if(ok&&image&&line&&line.image!==image){line.image=image;save();if(config)requestSync('product_media',{id:entry.id,sku:entry.sku,link:entry.link,image}).catch(()=>{/* Keep verified local URL for retry on a subsequent pull. */});}}
};
