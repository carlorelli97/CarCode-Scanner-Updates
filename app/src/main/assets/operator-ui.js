// Operator-focused layout; existing storage, scanner and shared API stay unchanged.
const style=document.createElement('style');
style.textContent=`
header{padding:15px 16px}header h1{font-size:23px}header small{font-size:10px;letter-spacing:1px}header .tag{white-space:nowrap;font-size:11px}
nav{gap:8px;padding:10px 12px}nav button{font-size:14px;min-height:46px}nav button[data-tab=settings]{flex:0 0 48px;font-size:24px;padding:4px}main{padding:8px 12px 72px}.panel{margin:8px 0;padding:14px}.panel h2{font-size:19px}
#cameraBtn{background:#477fea;color:white;font-size:18px;min-height:58px;margin:10px 0}#message{margin:9px 0;font-size:14px}#scanForm button{min-width:56px}#code{min-height:45px}#operatorSetup summary{color:#a6b9d0;font-size:13px;cursor:pointer;padding:6px 0}
#activeOrder .stat{font-size:40px;color:#83ddb7}#activeOrder .item button{background:transparent;color:#a6b9d0;font-size:12px;padding:6px}#closeOrder:not(:disabled){background:#16734a;min-height:56px}#closeOrder{min-height:56px}
#orders .order-tools{display:flex;gap:8px;align-items:center}#orders .order-tools button{margin:0;min-height:44px;flex:0 0 auto}#orderSearch{margin:0;min-height:44px}#list button{min-height:48px}#list button[disabled]{opacity:.55}#settings details{margin:8px 0}#settings summary{font-weight:700;cursor:pointer;padding:15px;background:#20334d;border-radius:10px}#settings details[open] summary{border-radius:10px 10px 0 0}#settings details .panel{margin:0 0 8px;border-radius:0 0 10px 10px}footer{padding:10px;font-size:11px}#setupHint{border:1px solid #477fea;background:#16263d;padding:12px;border-radius:12px;margin:8px 0;font-size:14px}#setupHint button{margin-top:8px;width:100%}#settings input[type=password]{font-size:14px}
`;
document.head.append(style);
const nav=document.querySelector('nav');nav.innerHTML='<button data-tab="scan" class="active">Scanner</button><button data-tab="orders">Ordini</button><button data-tab="history">Storico</button><button data-tab="settings" aria-label="Impostazioni" title="Impostazioni">⚙</button>';
nav.querySelectorAll('button').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
const settings=document.createElement('section');settings.id='settings';document.querySelector('main').append(settings);
function details(title,content){const d=document.createElement('details'),s=document.createElement('summary');s.textContent=title;d.append(s,...content);settings.append(d);return d;}
const orderPanels=Array.from($('orders').children);const listPanel=$('list').closest('.panel');const syncDetails=details('Collegamento Google',[syncPanel]);
details('Caricamento locale e ordine di prova',orderPanels.filter(p=>p!==syncPanel&&p!==listPanel));
const archiveDetails=details('Archivio SKU, varianti ed EAN',Array.from($('archive').children));
const refresh=$('refreshSync');const toolsBar=document.createElement('div');toolsBar.className='order-tools';const search=document.createElement('input');search.id='orderSearch';search.placeholder='Cerca numero ordine';search.autocomplete='off';refresh.textContent='↻ Aggiorna';refresh.className='primary';toolsBar.append(search,refresh);listPanel.insertBefore(toolsBar,$('list'));
const operator=$('operator'),operatorLabel=operator.previousElementSibling;const setup=document.createElement('details');setup.id='operatorSetup';const summary=document.createElement('summary');setup.append(summary);operatorLabel.before(setup);setup.append(operatorLabel,operator);setup.open=!operator.value.trim();
function operatorText(){summary.textContent=operator.value.trim()?'Operatore: '+operator.value.trim()+' · Modifica':'Imposta nome operatore';}operator.addEventListener('change',()=>{operatorText();if(operator.value.trim())setup.open=false;});operatorText();
const statusTag=document.querySelector('header .tag');const hint=document.createElement('div');hint.id='setupHint';hint.innerHTML='Collega CarCode al registro condiviso per ricevere gli ordini.<button class="primary" id="setupLink">Configura collegamento</button>';$('scan').prepend(hint);$('setupLink').onclick=()=>{tab('settings');syncDetails.open=true;};
const uiRender=render;
render=function(){uiRender();const connected=!!config;hint.hidden=connected;statusTag.textContent=connected?'GOOGLE':'LOCALE';statusTag.style.color=connected?'#83ddb7':'#a6b9d0';if(!visibleTab('orders'))return;const ids=Object.keys(state.orders);$('list').querySelectorAll('[data-index]').forEach(b=>{const o=state.orders[ids[+b.dataset.index]];if(connected&&o?.owner&&o.owner!==device){b.disabled=true;b.append(document.createTextNode(' · In lavorazione'));}});};
let searchTimer;search.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{orderPage=0;render();},120)});
let skuTimer;$('search').oninput=()=>{clearTimeout(skuTimer);skuTimer=setTimeout(()=>{catalogPage=0;render()},120)};
archiveDetails.addEventListener('toggle',()=>{if(archiveDetails.open&&visibleTab('settings'))render()});
// Keep connection settings hidden after configuration, without changing stored credentials.
syncDetails.open=!config;document.querySelector('footer').textContent='Creato da Carlo Relli © 2026  •  CarCode';
const camera=$('cameraBtn');camera.textContent='▣  SCANSIONA BARCODE';const scanPanel=$('scanForm').closest('.panel');scanPanel.insertBefore(camera,$('scanForm'));$('code').placeholder='Barcode pistola / inserimento manuale';
render();
// Version and updater remain visible without exposing technical settings.
document.querySelector('header small').textContent='CONTROLLO IMBALLAGGIO · 2.8';
const updatePanel=document.createElement('div');
updatePanel.className='panel';
updatePanel.innerHTML='<h2>Versione 2.8</h2><p class="muted">Controllo automatico all’apertura.</p><button class="primary wide" id="checkUpdates">Controlla aggiornamenti</button>';
details('Aggiornamenti CarCode',[updatePanel]);
$('checkUpdates').onclick=()=>{if(window.CarCodeNative)CarCodeNative.checkUpdates();};
const dashboard=document.createElement('div');
dashboard.className='panel';
dashboard.innerHTML='<div class="row"><div><small>ORDINI DA PREPARARE</small><div class="stat" id="openCount">0</div></div><span class="spacer"></span><div><small>CHIUSI</small><div class="stat good" id="closedCount">0</div></div></div>';
$('scan').insertBefore(dashboard,$('scan').querySelector('.panel'));
const previousRender=render;
const expiredPanel=document.createElement('div');
expiredPanel.className='panel';
expiredPanel.innerHTML='<h2>Ordini scaduti (36 ore)</h2><p class="muted">Non più disponibili per la preparazione.</p><div id="expiredList"></div>';
$('history').append(expiredPanel);
render=function(){
 previousRender();$('openCount').textContent=Object.keys(state.orders).length;$('closedCount').textContent=state.history.length;dashboard.hidden=!!state.current;
 expiredPanel.hidden=!config;
 const old=Array.isArray(state.expired)?state.expired:[];
 if(visibleTab('history'))$('expiredList').innerHTML=old.length?old.map(o=>'<div class="item"><b class="bad">'+esc(o.id)+'</b><p>'+esc(new Date(o.date).toLocaleString('it-IT'))+' · Scaduto</p></div>').join(''):'<p>Nessun ordine scaduto.</p>';
 const order=state.orders[state.current];
 if(order&&visibleTab('scan')){
  const cards=$('activeOrder').querySelectorAll('.item');
  order.lines.forEach((line,i)=>{
   const card=cards[i];if(!card)return;
   const b=card.querySelector('b'), sku=card.querySelector('.muted');
   b.textContent=line.title||'Titolo originale non ancora ricevuto';
   b.style.display='block';b.style.fontSize='18px';b.style.lineHeight='1.35';
   const variant=document.createElement('div');variant.className='good';variant.style.fontSize='24px';variant.style.fontWeight='800';
   variant.textContent=line.variant||state.catalog[line.sku]?.variant||'Variante non disponibile';
   b.after(variant);sku.textContent='SKU: '+line.sku;
   if(line.location){const place=document.createElement('div');place.className='tag';place.textContent=line.location;sku.after(place);}
   if(line.alerts){const alert=document.createElement('div');alert.className='bad';alert.style.fontWeight='bold';alert.textContent=line.alerts;card.prepend(alert);}
  });
 }
 if(visibleTab('orders')){const ids=Object.keys(state.orders);$('list').querySelectorAll('[data-index]').forEach(button=>{
  const o=state.orders[ids[+button.dataset.index]];if(!o)return;
  const titles=o.lines.map(l=>[l.title,l.variant||state.catalog[l.sku]?.variant].filter(Boolean).join(' · ')).filter(Boolean);
  if(titles.length){const summary=document.createElement('div');summary.className='muted';summary.style.marginTop='6px';summary.textContent=titles.join(' | ');button.append(summary);}
 });}
};
render();
