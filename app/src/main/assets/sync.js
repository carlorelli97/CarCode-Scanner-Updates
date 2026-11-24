// Shared mode: every claim, scan, undo and closure is validated by the server.
const syncPanel=document.createElement('div');syncPanel.className='panel';syncPanel.innerHTML='<h2>Sincronizzazione Google</h2><p>Collega i dispositivi allo stesso registro. Nessuna credenziale OAuth desktop necessaria.</p><label>URL applicazione Google Apps Script</label><input id="syncUrl" placeholder="https://script.google.com/macros/s/…/exec"><label>Codice di accesso del magazzino</label><input id="syncToken" type="password" autocomplete="off"><button id="connectSync" class="primary wide">Collega e aggiorna</button><button id="refreshSync" class="wide">Aggiorna ordini e SKU</button><label>Carica nuovi ordini condivisi (CSV)</label><input id="sharedCsv" type="file" accept=".csv,.tsv"><p id="syncStatus" class="muted">Non connesso</p>'; $('orders').prepend(syncPanel);
let config;try{config=JSON.parse(localStorage.getItem('carcode-sync')||'null')}catch{}let device=localStorage.getItem('carcode-device');if(!device){device=Array.from(crypto.getRandomValues(new Uint8Array(24)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('carcode-device',device)}let pending=null;
if(config){$('syncUrl').value=config.url;$('syncToken').value=config.token;}
const queue=[];let saveTimer=null,saveIdle=null;
const saveLocal=save;
function flushCache(){clearTimeout(saveTimer);saveTimer=null;if(saveIdle!==null&&window.cancelIdleCallback)cancelIdleCallback(saveIdle);saveIdle=null;try{saveLocal()}catch(e){/* Server remains authoritative; leave the previous cache intact if storage is full. */}}
save=function(){if(!config)return saveLocal();clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(window.requestIdleCallback){if(saveIdle!==null)cancelIdleCallback(saveIdle);saveIdle=requestIdleCallback(flushCache,{timeout:2000});}else flushCache();},500)};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&saveTimer!==null)flushCache()});
function drain(){if(pending||!queue.length)return;pending=queue.shift();try{CarCodeNative.sync(pending.url,JSON.stringify(pending.body));}catch(e){const p=pending;pending=null;p.reject(e);setTimeout(drain,0);}}
function requestSync(action,extra={}){return new Promise((resolve,reject)=>{if(!window.CarCodeNative||!config){reject(Error('Sincronizzazione disponibile nell’app Android configurata'));return}if(queue.length>=30){reject(Error('Troppe letture in attesa: attendi'));return}queue.push({resolve,reject,url:config.url,body:{token:config.token,device,action,compact:true,...extra}});drain();});}
window.syncResult=function(raw){if(!pending)return;let p=pending;pending=null;try{let x=JSON.parse(raw);if(!x.ok)throw Error(x.error||'Errore Google');p.resolve(x)}catch(e){p.reject(e)}finally{setTimeout(drain,0)}};
const EXPIRY_MS=36*60*60*1000;
let serverOffset=Number(localStorage.getItem('carcode-server-offset'))||0;
function expireCached(){
 if(!config)return false;
 const expired=Array.isArray(state.expired)?state.expired:[];let changed=false;
 const now=Date.now()+serverOffset;
 for(const [id,o] of Object.entries(state.orders)){
  const received=Date.parse(o.receivedAt);if(!Number.isFinite(received)||now-received<EXPIRY_MS)continue;
  if(!expired.some(x=>x.id===id))expired.unshift({id,date:new Date(received+EXPIRY_MS).toISOString()});
  delete state.orders[id];if(state.current===id){state.current=null;notify('Ordine scaduto dopo 36 ore');}changed=true;
 }
 const history=state.history.filter(o=>{const t=Date.parse(o.receivedAt||o.date);return Number.isFinite(t)&&now-t<EXPIRY_MS;});
 if(history.length!==state.history.length){state.history=history;changed=true;}
 if(expired.some(o=>o.lines)){changed=true;}
 state.expired=expired.filter(o=>{const t=Date.parse(o.date);return Number.isFinite(t)&&now-t<EXPIRY_MS;}).slice(0,100).map(o=>({id:o.id,date:o.date}));
 if(changed)save();
 return changed;
}
function applyRemote(x){
 if(Number.isFinite(Date.parse(x.serverTime))){serverOffset=Date.parse(x.serverTime)-Date.now();try{localStorage.setItem('carcode-server-offset',String(serverOffset))}catch{}}
 if(x.delta&&x.id&&x.order){const id=x.id,o=x.order;if(o.closed){delete state.orders[id];state.history=state.history.filter(h=>h.id!==id);state.history.unshift({id,operator:o.operator,date:o.date,receivedAt:o.receivedAt,lines:o.lines});}else state.orders[id]=o;}
 else{state.catalog=x.catalog||{};state.orders={};state.history=[];if(Array.isArray(x.expired))state.expired=x.expired;for(const [id,o] of Object.entries(x.orders||{})){if(o.closed)state.history.push({id,operator:o.operator,date:o.date,receivedAt:o.receivedAt,lines:o.lines});else state.orders[id]=o}state.history.sort((a,b)=>String(b.date).localeCompare(String(a.date)));}
 expireCached();if(state.current&&state.orders[state.current]?.owner!==device)state.current=null;save();$('syncStatus').textContent='Collegato • '+new Date().toLocaleTimeString('it-IT');render()
}
async function remote(action,body={}){try{if(action!=='pull'){$('message').textContent=action==='scan'?'Lettura in verifica…':'Sincronizzazione…';$('message').className='muted';}let x=await requestSync(action,body);applyRemote(x);return true}catch(e){$('syncStatus').textContent=e.message;notify(e.message);return false}}
const localSelect=selectOrder,localReceive=receiveScan,localRender=render;
selectOrder=async function(id){if(!config)return localSelect(id);if(state.current&&state.current!==id){notify('Rilascia prima l’ordine aperto.');return}if(await remote('claim',{id})){state.current=id;save();tab('scan');notify('Ordine assegnato a questo dispositivo',true);$('code').focus()}};
receiveScan=async function(value){if(!config)return localReceive(value);let code=norm(value);if(!code)return;if(!state.current)return selectOrder(code);if(await remote('scan',{id:state.current,code}))notify('Prodotto verificato',true)};
render=function(){localRender();let connected=!!config;for(const id of ['orderFile','addLine','demo','catalogFile','saveSku'])$(id).disabled=connected;$('sharedCsv').disabled=!connected;$('refreshSync').disabled=!connected;if(!connected||!visibleTab('scan'))return;let o=state.orders[state.current];if(!o)return;$('leave').onclick=async()=>{if(await remote('release',{id:state.current})){state.current=null;save();render()}};document.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>remote('undo',{id:state.current,sku:o.lines[+b.dataset.undo].sku}));$('closeOrder').onclick=async()=>{let operator=$('operator').value.trim();if(!operator){notify('Inserisci il nome operatore');return}if(await remote('close',{id:state.current,operator})){state.current=null;state.operator=operator;save();render();notify('Pacco verificato e sincronizzato!',true)}}};
$('connectSync').onclick=async()=>{if(config&&state.current){notify('Rilascia prima l’ordine aperto');return}let url=$('syncUrl').value.trim(),token=$('syncToken').value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)||token.length<24){$('syncStatus').textContent='URL o codice non valido (almeno 24 caratteri).';return}let old=config;config={url,token};if(await remote('pull')){localStorage.setItem('carcode-sync',JSON.stringify(config));render()}else{config=old;render()}};
$('refreshSync').onclick=()=>remote('pull');$('sharedCsv').onchange=async()=>{let file=$('sharedCsv').files[0];if(!file)return;try{let rows=parseCSV(await file.text()),h=rows.shift().map(norm),s=h.indexOf('SKU'),o=h.indexOf('ORDINE'),q=h.findIndex(x=>['QUANTITA','QUANTITÀ','QTY'].includes(x)),v=h.indexOf('VARIANTE');if(Math.min(s,o,q)<0)throw Error('CSV: servono ORDINE, SKU, QUANTITA');let orders=Object.create(null);for(let r of rows){let id=norm(r[o]),sku=norm(r[s]),qty=Number(r[q]);if(!id||!sku||!Number.isSafeInteger(qty)||qty<1)throw Error('Riga CSV non valida');let order=orders[id]??={lines:[]},line=order.lines.find(x=>x.sku===sku);if(line)line.qty+=qty;else order.lines.push({sku,qty,variant:r[v]||''})}await remote('import',{orders})}catch(e){$('syncStatus').textContent=e.message}$('sharedCsv').value=''};
expireCached();
render();if(config&&window.CarCodeNative)remote('pull');
// Check the cache even while a package is open. Refresh idle devices automatically.
setInterval(()=>{if(!pending&&expireCached())render();},10000);
function idleRefresh(force=false){if(!config||!window.CarCodeNative||pending||queue.length||state.current||(!force&&document.hidden))return;requestSync('pull').then(x=>{const current={...state.orders};for(const h of state.history)if(x.orders?.[h.id]?.closed)current[h.id]=x.orders[h.id];if(JSON.stringify(current)!==JSON.stringify(x.orders||{})||JSON.stringify(state.catalog)!==JSON.stringify(x.catalog||{}))applyRemote(x);else if(expireCached())render();}).catch(()=>{});}
window.cameraRefresh=()=>{if(!config){CarCodeNative.cameraSyncStatus('Archivio locale');return;}if(pending||queue.length||state.current)return;requestSync('pull').then(x=>{applyRemote(x);CarCodeNative.cameraSyncStatus('Sincronizzato · '+new Date().toLocaleTimeString('it-IT'));}).catch(()=>CarCodeNative.cameraSyncStatus('Sincronizzazione non riuscita'));};
setInterval(idleRefresh,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(!pending&&expireCached())render();idleRefresh();}});
