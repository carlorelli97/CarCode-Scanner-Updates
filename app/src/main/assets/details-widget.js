// Order details are a read-only view; only the separate packing button claims the order.
const detailPanel=document.createElement('div');detailPanel.className='panel';detailPanel.hidden=true;
listPanel.after(detailPanel);
let detailId=null,widgetStamp=Number(localStorage.getItem('carcode-widget-stamp'))||0,widgetSignature='';
const detailBase=render;
function openDetails(id){detailId=id;tab('orders');window.scrollTo(0,0);}
function detailCard(id){
 const o=state.orders[id];if(!o)return '';
 const locked=!!config&&o.owner&&o.owner!==device,done=o.lines.reduce((n,l)=>n+(Number(l.done)||0),0),total=o.lines.reduce((n,l)=>n+Number(l.qty),0);
 return '<div class="item"><h2>'+esc(id)+'</h2><p class="'+(locked?'bad':'good')+'">'+(locked?'In lavorazione su altro palmare':done===total?'Tutti i pezzi verificati':'Da preparare')+'</p><div class="stat">'+done+' / '+total+'</div><small>Quantità verificata</small>'+o.lines.map(l=>'<div class="item"><b style="font-size:19px;line-height:1.4">'+esc(l.title||l.sku)+'</b><div class="good" style="font-size:23px;font-weight:800;margin:8px 0">'+esc(l.variant||state.catalog[l.sku]?.variant||'Variante non disponibile')+'</div><div>SKU: '+esc(l.sku)+'</div>'+(state.catalog[l.sku]?.ean?'<div>EAN: '+esc(state.catalog[l.sku].ean)+'</div>':'')+'<p>Quantità: <b>'+l.qty+'</b> · Verificati: '+(l.done||0)+'</p>'+(l.location?'<div class="tag">Ubicazione: '+esc(l.location)+'</div>':'')+(l.alerts?'<p class="bad"><b>'+esc(String(l.alerts).replace(/\s*\[[^\]]+\]/g,''))+'</b></p>':'')+productMediaMarkup(l,id)+'</div>').join('')+'<button class="primary wide" data-detail-pack="'+esc(id)+'" '+(locked?'disabled':'')+'>Verifica questo pacco</button></div>';
}
function drawDetails(){
 if(!visibleTab('orders'))return;
 listPanel.hidden=!!detailId;detailPanel.hidden=!detailId;
 const ids=Object.keys(state.orders);$('list').querySelectorAll('[data-index]').forEach(b=>{b.disabled=false;b.onclick=()=>openDetails(ids[+b.dataset.index]);});
 if(!detailId)return;
 const current=state.orders[detailId];const group=current?relatedIds(detailId,current):[];
 detailPanel.innerHTML='<button id="backOrderList" class="wide">‹ Torna agli ordini</button><h2 style="margin-top:18px">'+(group.length>1?'Doppio ordine · '+group.length+' ordini':'Dettagli ordine')+'</h2>'+ (group.length?group.map(detailCard).join(''):'<p>Ordine non più disponibile.</p>');
 attachProductMedia();
 $('backOrderList').onclick=()=>{detailId=null;render();};
 detailPanel.querySelectorAll('[data-detail-pack]').forEach(b=>b.onclick=async()=>{const id=b.dataset.detailPack;if(state.current&&state.current!==id){window.alert('Rilascia prima il pacco già in verifica nella schermata Scanner.');return;}await selectOrder(id);if(state.current===id){detailId=null;packing=true;tab('scan');}});
}
function publishWidget(){if(!window.CarCodeNative?.widgetStatus)return;const open=Object.keys(state.orders).length,done=state.history.length;const sig=[open,done,widgetStamp].join(':');if(sig===widgetSignature)return;widgetSignature=sig;CarCodeNative.widgetStatus(open,done,widgetStamp);}
const detailApply=applyRemote;
applyRemote=function(x){widgetStamp=Date.now();try{localStorage.setItem('carcode-widget-stamp',String(widgetStamp))}catch{}detailApply(x);publishWidget();};
render=function(){detailBase();drawDetails();publishWidget();};
window.openWidgetAction=function(action){
 if(action==='orders'){detailId=null;tab('orders');return;}
 if(action==='history'){tab('history');return;}
 packing=false;lookupCode='';tab('scan');
 if(action==='scan')$('cameraBtn').click();else $('code').focus();
};
render();if(window.CarCodeNative?.ready)CarCodeNative.ready();
