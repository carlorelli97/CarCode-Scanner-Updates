/* CarCode 2.5: dashboard and workflow, retaining the existing server-owned packing state. */
const dash25=document.createElement('div');dash25.id='dash25';dash25.className='panel';
const oldDash=$('openCount').closest('.panel');oldDash.hidden=true;
const sheet25=document.createElement('style');sheet25.textContent=`[hidden]{display:none!important}#dash25{background:transparent;border:0;padding:0} .dashgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.dashgrid button{min-height:87px;text-align:left;padding:13px;background:#182b43;border:1px solid #304d6c;border-radius:16px}.dashgrid b{display:block;font-size:30px;line-height:1.1;margin-bottom:5px}.dashgrid small{font-size:13px;color:#d1dfef}.dashactions{margin-top:10px}.dashactions button{min-height:56px;text-align:center}.dashhero{display:flex;align-items:center;justify-content:space-between;margin:10px 0}#dashStatus{font-size:12px;color:#a6b9d0}#dashScan{min-height:64px;font-size:20px;margin:10px 0;background:#3268d0}#activeOrder .item{border:1px solid #304d6c;border-radius:15px;padding:12px;margin:10px 0}#activeOrder .product-media{display:grid;grid-template-columns:minmax(90px,1fr) minmax(100px,1fr);align-items:center;gap:8px;margin:8px 0}#activeOrder .product-media button{background:#20334d;min-height:44px;color:white}#activeOrder .media-photo img{max-height:128px!important}#activeOrder .media-photo{background:#f7f8fa;border-radius:8px;color:#425266;text-align:center;overflow:hidden}#activeOrder .media-photo:empty{display:none}.order-alert{border:1px solid #b26c58;background:#402d32;border-radius:12px;padding:10px;margin:8px 0;color:#ffb7a6}.order-label{display:block;color:#afc7e7;font-size:12px;font-weight:bold}.order-list-media{display:flex;gap:10px;align-items:center}.order-list-media .product-media{max-width:130px;flex-shrink:0}.order-list-media .product-media button{font-size:11px;min-height:32px;padding:6px}.order-list-media img{max-height:86px!important}#scanForm input{font-size:16px}#activeOrder #closeOrder{font-size:18px}#filterStatus{padding:6px 0}#operatorStats .item{padding:10px 0}footer{position:static}main{padding-bottom:16px}`;document.head.append(sheet25);
dash25.innerHTML=`<div class="dashhero"><div><h2>Magazzino</h2><span id="dashStatus">Archivio locale</span></div><button id="dashSettings" aria-label="Impostazioni">⚙</button></div><div class="dashgrid"><button data-filter="all"><b id="dashOpen" style="color:#8bb6ff">0</b><small>Da preparare</small></button><button data-filter="closed"><b id="dashClosed" class="good">0</b><small>Completati</small></button><button data-filter="prime"><b id="dashPrime" style="color:#ffd078">0</b><small>Prime segnalati</small></button><button data-filter="double"><b id="dashDouble" class="bad">0</b><small>Doppi ordini</small></button></div><button class="primary wide" id="dashScan">▣ SCANSIONA ORDINE</button><div class="dashgrid dashactions"><button id="dashFind">Cerca ordine / SKU</button><button id="dashList">Ordini aperti</button><button id="dashSync">↻ Sincronizza</button><button id="dashStats">Statistiche operatori</button></div>`;
oldDash.before(dash25);
let orderFilter25='all', autoPack25=true, lastSync25=0, syncFailed25=false;
function isPrime25(o){return o.prime===true||o.lines.some(l=>l.prime===true||/(?:^|[\s,;|])PRIME(?:$|[\s,;|])/i.test(String(l.alerts||'')));}
function isDouble25(o){return o.lines.some(l=>/DOPPIO ORDINE/i.test(l.alerts||''));}
function passes25(o){return orderFilter25==='all'||(orderFilter25==='prime'&&isPrime25(o))||(orderFilter25==='double'&&isDouble25(o));}
const filterStatus=document.createElement('div');filterStatus.id='filterStatus';filterStatus.className='muted';listPanel.insertBefore(filterStatus,$('list'));
function list25(filter='all'){orderFilter25=filter;detailId=null;orderPage=0;$('orderSearch').value='';tab('orders');}
function home25(mode){if(state.current){packing=true;tab('scan');return;}autoPack25=mode==='pack';packing=autoPack25;lookupCode='';tab('scan');$('code').focus();}
dash25.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>b.dataset.filter==='closed'?tab('history'):list25(b.dataset.filter));
$('dashSettings').onclick=()=>tab('settings');$('dashFind').onclick=()=>home25('find');$('dashList').onclick=()=>list25();$('dashScan').onclick=()=>{home25('pack');$('cameraBtn').click();};$('dashSync').onclick=async()=>{if(!config){tab('settings');syncDetails.open=true;return;}await remote('pull');};$('dashStats').onclick=()=>tab('history');
const stats25=document.createElement('div');stats25.id='operatorStats';stats25.className='panel';$('history').prepend(stats25);
const prevRemote25=remote;remote=async function(action,body={}){const ok=await prevRemote25(action,body);if(ok){lastSync25=Date.now();syncFailed25=false;}else syncFailed25=true;refreshStatus25();return ok;};
const prevApply25=applyRemote;applyRemote=function(x){lastSync25=Date.now();syncFailed25=false;prevApply25(x);};
window.syncHealth25=function(ok){syncFailed25=!ok;if(ok)lastSync25=Date.now();refreshStatus25();};
function refreshStatus25(){const n=$('dashStatus');if(!n)return;n.textContent=!config?'Archivio locale':syncFailed25?'Connessione da verificare · consultazione cache':lastSync25?'Sincronizzato '+new Date(lastSync25).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'In attesa di sincronizzazione';}
// The existing exact-id / SKU / EAN lookup remains read-only unless the operator selects packing.
const prevReceive25=receiveScan;let scanInFlight25=false;
const cameraLookupBase25=window.cameraLookup;
receiveScan=async function(value){const code=norm(value);if(!code)return;if(scanInFlight25){notify('Attendi la conferma della lettura precedente');return;}scanInFlight25=true;try{
 if(state.current&&packing){await prevReceive25(code);return;}
 if(autoPack25&&state.orders[code]){const ids=relatedIds(code,state.orders[code]);if(ids.length>1||isDouble25(state.orders[code])){packing=false;autoPack25=false;await prevReceive25(code);return;}await selectOrder(code);return;}
 if(autoPack25){packing=false;await prevReceive25(code);if(state.orders[code]&&!isDouble25(state.orders[code])&&relatedIds(code,state.orders[code]).length===1){await selectOrder(code);return;}}else await prevReceive25(code);
 }finally{scanInFlight25=false;if(visibleTab('scan'))$('code').focus();}};
$('lookupMode').addEventListener('click',()=>{autoPack25=false;});$('packMode').addEventListener('click',()=>{autoPack25=true;});
const prevRender25=render;
render=function(){prevRender25();oldDash.hidden=true;const orders=Object.values(state.orders);dash25.hidden=!!state.current||(!packing&&!!lookupCode);$('dashOpen').textContent=orders.length;$('dashClosed').textContent=state.history.length;$('dashPrime').textContent=orders.filter(isPrime25).length;$('dashDouble').textContent=orders.filter(isDouble25).length;refreshStatus25();
 if(visibleTab('scan')&&packing&&state.orders[state.current]){const o=state.orders[state.current],id=state.current;const cards=$('activeOrder').querySelectorAll('.item');o.lines.forEach((l,i)=>{const card=cards[i];if(card){card.insertAdjacentHTML('beforeend',productMediaMarkup(l,id));}});if(isDouble25(o)){const group=relatedIds(id,o);$('activeOrder').firstElementChild.insertAdjacentHTML('afterbegin','<div class="order-alert"><b>DOPPIO ORDINE</b><div>'+esc(group.filter(x=>x!==id).join(' · ')||'Controlla gli ordini collegati')+'</div></div>');}if(isPrime25(o))$('activeOrder').firstElementChild.insertAdjacentHTML('afterbegin','<div class="tag">PRIME</div>');attachProductMedia();}
 if(visibleTab('orders')&&!detailId){filterStatus.textContent=orderFilter25==='all'?'Tutti gli ordini aperti':orderFilter25==='prime'?'Prime segnalati · soltanto dati ricevuti':'Doppi ordini segnalati';if(orderFilter25!=='all'){const b=document.createElement('button');b.textContent='Mostra tutti';b.onclick=()=>list25();filterStatus.append(' ',b);}const ids=Object.keys(state.orders);$('list').querySelectorAll('[data-index]').forEach(b=>{const id=ids[+b.dataset.index],o=state.orders[id];if(!o)return;const line=o.lines[0];if(!line)return;const wrap=document.createElement('div');wrap.className='order-list-media';b.before(wrap);wrap.append(b);const media=document.createElement('div');media.innerHTML=productMediaMarkup(line,id);wrap.append(media);if(o.lines.length>1){const note=document.createElement('small');note.textContent=' · '+o.lines.length+' articoli';b.append(note);}});attachProductMedia();}
 if(visibleTab('history')){const counts=new Map();for(const h of state.history){const n=h.operator||'Non indicato';counts.set(n,(counts.get(n)||0)+1);}stats25.innerHTML='<h2>Operatori · ultime 36 ore</h2>'+([...counts].sort((a,b)=>b[1]-a[1]).map(([name,n])=>'<div class="item row"><b>'+esc(name)+'</b><span class="count">'+n+'</span></div>').join('')||'<p>Nessun ordine completato</p>');}
};
// Restore packing view after reopening if an assigned order is cached.
packing=!!state.current||autoPack25;render();
// Back to the dashboard even after an empty search; preserve any open pack.
document.querySelector('nav [data-tab=scan]').onclick=()=>home25('pack');
window.cameraLookup=async function(value){
 if(scanInFlight25){window.CarCodeNative?.cameraFeedback('Attendi la conferma precedente');return;}
 const was=state.current;
 if(!packing&&!autoPack25)return cameraLookupBase25(value);
 await receiveScan(value);
 const active=state.orders[state.current];
 window.CarCodeNative?.cameraFeedback($('message').textContent);
 if((!was&&(!!active||resultsFor(value).ids.length>0))||(was&&(!active||!packing||active.lines.every(l=>l.done===l.qty))))window.CarCodeNative?.showLookupResults();
};
if(!state.current&&!config)$('code').focus();
