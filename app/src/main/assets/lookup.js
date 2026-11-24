// Read-only barcode lookup. Packing and quantities change only on explicit user action.
const lookupPanel=document.createElement('div');
lookupPanel.className='panel';lookupPanel.hidden=true;$('activeOrder').before(lookupPanel);
const modeBar=document.createElement('div');modeBar.className='row';
modeBar.innerHTML='<button id="lookupMode" class="primary spacer">Cerca ordini / EAN</button><button id="packMode" class="spacer">Verifica pacco</button>';
$('cameraBtn').before(modeBar);
let packing=false,lookupCode='',lookupPage=0,lookupBusy=false;
const packReceive=receiveScan,lookupRenderBase=render;
function relatedIds(id,o){
 const ids=new Set([id]);
 for(const line of o.lines||[]){const m=String(line.alerts||'').match(/DOPPIO ORDINE\s*\[([^\]]+)\]/i);if(m)for(const other of m[1].split(',').map(norm))if(state.orders[other])ids.add(other);}
 for(const [other,obj] of Object.entries(state.orders))for(const line of obj.lines||[]){const m=String(line.alerts||'').match(/DOPPIO ORDINE\s*\[([^\]]+)\]/i);if(m&&m[1].split(',').map(norm).includes(id))ids.add(other);}
 return [...ids];
}
// UPC-A may be reported as 12 digits even when the archived EAN-13 begins with zero.
function gtinKey(value){const code=norm(value);return /^(?:\d{8}|\d{12,14})$/.test(code)?code.padStart(14,'0'):null;}
function codeMatches(line,value){
 const sku=norm(line.sku),code=norm(value),ean=norm(line.ean||line.barcode||state.catalog[sku]?.ean);
 return sku===code||!!(ean&&(ean===code||(gtinKey(ean)&&gtinKey(ean)===gtinKey(code))));
}
function resultsFor(value){
 const code=norm(value),exact=state.orders[code];
 if(exact)return {kind:'order',ids:relatedIds(code,exact)};
 return {kind:/^\d{8,14}$/.test(code)?'ean':'sku',ids:Object.entries(state.orders).filter(([,o])=>o.lines.some(l=>codeMatches(l,code))).map(([id])=>id)};
}
function drawLookup(){
 $('lookupMode').classList.toggle('primary',!packing);$('packMode').classList.toggle('primary',packing);
 $('activeOrder').hidden=!packing;lookupPanel.hidden=packing||!lookupCode;
 $('scanForm').closest('.panel').querySelector('h2').textContent=packing?'Verifica pacco':'Ricerca ordine, SKU o EAN';
 if(lookupPanel.hidden)return;
 const result=resultsFor(lookupCode),ids=result.ids,productSearch=result.kind!=='order';
 lookupPanel.innerHTML='<h2>'+(productSearch?'Prodotto '+esc(lookupCode)+' · '+ids.length+' ordini':ids.length>1?'DOPPIO ORDINE · '+ids.length+' ordini':'Ordine '+esc(lookupCode))+'</h2><p>Ricerca di sola lettura: nessuna quantità modificata.</p><div id="lookupList"></div>';
 if(!productSearch&&ids.length===1&&state.orders[lookupCode].lines.some(l=>/DOPPIO ORDINE/i.test(l.alerts||'')))lookupPanel.insertAdjacentHTML('beforeend','<p class="bad">Doppio ordine segnalato. Identificativi collegati non ancora ricevuti dal PC.</p>');
 paged($('lookupList'),ids,lookupPage,p=>lookupPage=p,id=>{
  const o=state.orders[id],locked=!!config&&o.owner&&o.owner!==device;
  const lines=productSearch?o.lines.filter(l=>codeMatches(l,lookupCode)):o.lines;
  const count=lines.reduce((sum,l)=>sum+Number(l.qty||0),0);
  return '<div class="item"><h3>Ordine '+esc(id)+'</h3>'+(productSearch?'<div class="tag">'+lines.length+' prodotti · '+count+' pezzi corrispondenti</div>':'')+
   lines.map(l=>'<div style="margin:8px 0"><b>'+esc(l.title||l.sku)+'</b><div class="good">'+esc(l.variant||state.catalog[l.sku]?.variant||'Variante non disponibile')+'</div><small>SKU: '+esc(l.sku)+' · '+l.qty+' pezzi · '+(l.done||0)+'/'+l.qty+' verificati</small>'+(l.location?'<div>'+esc(l.location)+'</div>':'')+(l.alerts?'<div class="bad">'+esc(String(l.alerts).replace(/\s*\[[^\]]+\]/g,''))+'</div>':'')+productMediaMarkup(l,id)+'</div>').join('')+
   '<button class="wide primary" data-open-order="'+esc(id)+'">Apri dettaglio ordine</button>'+
   '<button class="wide" data-pack="'+esc(id)+'" '+(locked?'disabled':'')+'>'+(locked?'In lavorazione su altro palmare':'Verifica questo pacco')+'</button></div>';
 },'Nessun ordine attivo corrispondente.');
 attachProductMedia();
 lookupPanel.querySelectorAll('[data-open-order]').forEach(b=>b.onclick=()=>openDetails(b.dataset.openOrder));
 lookupPanel.querySelectorAll('[data-pack]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.pack;if(state.current&&state.current!==id){notify('Rilascia prima il pacco già in verifica.');return;}
  await selectOrder(id);if(state.current===id){packing=true;render();}
 });
}
render=function(){lookupRenderBase();if(visibleTab('scan'))drawLookup();};
$('lookupMode').onclick=()=>{packing=false;render();$('code').focus();};
$('packMode').onclick=()=>{packing=true;render();$('code').focus();};
const chooseOrder=selectOrder;
selectOrder=async function(id){await chooseOrder(id);if(state.current===id){packing=true;render();}};
receiveScan=async function(value){
 const code=norm(value);if(!code)return;
 if(packing&&state.current){
  if(code===state.current){notify('Ordine già aperto. Scansiona un prodotto.',true);return;}
  if(state.orders[code]){packing=false;lookupCode=code;lookupPage=0;openDetails(code);notify('Dettaglio ordine aperto senza modifiche.',true);return;}
  return packReceive(code);
 }
 if(packing&&!state.current&&state.orders[code])return selectOrder(code);
 packing=false;lookupCode=code;lookupPage=0;
 let result=resultsFor(code);
 if(!result.ids.length&&config&&!lookupBusy){
  lookupBusy=true;
  try{await remote('pull');}finally{lookupBusy=false;}
  if(lookupCode!==code)return;
  result=resultsFor(code);
 }
 if(result.kind==='order'){
  openDetails(code); // Also shows linked double orders.
  notify(result.ids.length>1?'Doppio ordine trovato: '+result.ids.length+' ordini':'Dettaglio ordine '+code,true);
 }else{
  tab('scan');render();
  notify(result.ids.length?result.ids.length+' ordini con '+code:'Nessun ordine attivo per '+code,!!result.ids.length);
 }
};
render();
window.cameraLookup=async function(value){
 if(packing)return;
 const code=norm(value);
 await receiveScan(code);
 if(lookupCode!==code)return;
 const result=resultsFor(code),first=state.orders[result.ids[0]];
 const line=first?.lines?.find(l=>codeMatches(l,code))||first?.lines?.[0];
 const summary=result.ids.length?(result.kind==='order'&&result.ids.length>1?'DOPPIO ORDINE · ':'')+result.ids.length+' ordini · '+result.ids.slice(0,2).join(' / ')+(line?'\n'+line.sku+' · '+(line.variant||state.catalog[line.sku]?.variant||''):''):'Nessun ordine trovato · '+value;
 if(window.CarCodeNative){
  CarCodeNative.cameraFeedback(summary);
  // Show the order or the complete EAN results without a second tap.
  if(result.ids.length&&CarCodeNative.showLookupResults)CarCodeNative.showLookupResults();
 }
};
