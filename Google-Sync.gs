// Installare nel foglio Google CarCode. Impostare CARCODE_TOKEN nelle proprietà script.
function doPost(e) {
  var lock=LockService.getScriptLock(), acquired=false;
  try {
    var q=JSON.parse(e.postData.contents), p=PropertiesService.getScriptProperties();
    if(!p.getProperty('CARCODE_TOKEN') || q.token!==p.getProperty('CARCODE_TOKEN')) throw Error('Accesso negato');
    if(!q.device || !/^[a-zA-Z0-9-]{16,80}$/.test(q.device)) throw Error('Dispositivo non valido');
    lock.waitLock(15000); acquired=true;
    var ss=SpreadsheetApp.openById(p.getProperty('CARCODE_SHEET_ID'));
    var sheet=ss.getSheetByName('CARCODE_SCANNER_ORDINI');
    if(!sheet){sheet=ss.insertSheet('CARCODE_SCANNER_ORDINI');sheet.appendRow(['ORDINE','DATI JSON']);}
    if(q.compact===true&&['claim','scan','undo','release','close'].indexOf(q.action)>=0)return compactOrder(q,ss,sheet);
    var rows=sheet.getDataRange().getValues(), all=Object.create(null), locations=Object.create(null);
    var now=Date.now(), stamp=new Date(now).toISOString(), expiryChanged=false;
    for(var i=1;i<rows.length;i++){if(rows[i][0]&&rows[i][1]){
      var id=String(rows[i][0]), item=JSON.parse(rows[i][1]);all[id]=item;locations[id]=i+1;
      if(!item.closed&&!item.expired){
        // Older orders have no reliable import time: start their 36-hour clock on first sync.
        if(!Number.isFinite(Date.parse(item.receivedAt))){item.receivedAt=stamp;rows[i][1]=JSON.stringify(item);expiryChanged=true;}
        if(now-Date.parse(item.receivedAt)>=36*60*60*1000){item.expired=true;item.expiredAt=new Date(Date.parse(item.receivedAt)+36*60*60*1000).toISOString();item.owner=null;rows[i][1]=JSON.stringify(item);expiryChanged=true;}
      }
    }}
    if(expiryChanged&&rows.length>1)sheet.getRange(2,2,rows.length-1,1).setValues(rows.slice(1).map(function(r){return [r[1]];}));
    var catalog=Object.create(null), source=ss.getSheets()[0].getDataRange().getDisplayValues();
    for(var j=1;j<source.length;j++){var r=source[j];if(r[0]&&r[1])catalog[normal(r[0])]={variant:r[1],ean:''};}
    var aliases=ss.getSheetByName('CARCODE_SCANNER_BARCODE');if(!aliases){aliases=ss.insertSheet('CARCODE_SCANNER_BARCODE');aliases.appendRow(['SKU','EAN']);}
    var codes=aliases.getDataRange().getDisplayValues();for(var k=1;k<codes.length;k++){var sku=normal(codes[k][0]);if(catalog[sku])catalog[sku].ean=normal(codes[k][1]);}
    var id=normal(q.id), o=all[id], changed=false;
    function own(){if(o&&o.expired)throw Error('Ordine scaduto dopo 36 ore');if(!o||o.closed||o.owner!==q.device)throw Error('Ordine non assegnato a questo dispositivo');}
    function persist(key,obj){var row=locations[key]||sheet.getLastRow()+1;sheet.getRange(row,1,1,2).setValues([[key,JSON.stringify(obj)]]);all[key]=obj;}
    if(q.action==='import'){
      var incoming=q.orders||{};Object.keys(incoming).forEach(function(raw){var key=normal(raw);if(!/^[A-Z0-9][A-Z0-9_./ -]{0,119}$/.test(key))throw Error('Numero ordine non valido');var lines=incoming[raw].lines;if(!Array.isArray(lines)||!lines.length)throw Error('Ordine vuoto');var seen=Object.create(null);var clean=lines.map(function(l){var s=normal(l.sku),n=Number(l.qty);if(!s||!Number.isSafeInteger(n)||n<1||seen[s])throw Error('Riga non valida');seen[s]=true;return {sku:s,qty:n,done:0,variant:String(l.variant||''),title:String(l.title||''),location:String(l.location||''),alerts:String(l.alerts||'')};});
      var existing=all[key];
      if(existing){
        // Re-sending the original order enriches metadata without resetting counts, ownership or closure.
        if(existing.closed||existing.expired||existing.lines.length!==clean.length||!clean.every(function(l){return existing.lines.some(function(x){return x.sku===l.sku&&x.qty===l.qty;});}))return;
        var enriched=false;
        clean.forEach(function(l){var old=existing.lines.find(function(x){return x.sku===l.sku;});['variant','title','location','alerts'].forEach(function(field){if(l[field]&&old[field]!==l[field]){old[field]=l[field];enriched=true;}});});
        if(enriched)persist(key,existing);
      }else persist(key,{lines:clean,owner:null,closed:false,receivedAt:stamp});});
    }else if(q.action==='alias'){
      var sku=normal(q.sku),ean=normal(q.ean);if(!catalog[sku])throw Error('SKU assente dal registro Google');if(!/^\d{8,14}$/.test(ean))throw Error('EAN non valido: inserisci 8–14 cifre');
      var other=Object.keys(catalog).find(function(s){return s!==sku&&(catalog[s].ean===ean||s===ean);});if(other)throw Error('EAN già associato a '+other);
      var idx=codes.findIndex(function(r,i){return i>0&&normal(r[0])===sku;});var row=idx>0?idx+1:aliases.getLastRow()+1;
      aliases.getRange(row,1,1,2).setNumberFormat('@').setValues([[sku,ean]]);catalog[sku].ean=ean;
    }else if(q.action==='claim'){if(o&&o.expired)throw Error('Ordine scaduto dopo 36 ore');if(!o||o.closed)throw Error('Ordine non disponibile');if(o.owner&&o.owner!==q.device)throw Error('Ordine in lavorazione su un altro dispositivo');o.owner=q.device;changed=true;
    }else if(q.action==='scan'){own();var c=normal(q.code), matches=o.lines.filter(function(l){return l.sku===c||(catalog[l.sku]&&catalog[l.sku].ean===c);});if(matches.length!==1)throw Error('Prodotto non previsto o barcode ambiguo');var l=matches[0];if(l.done>=l.qty)throw Error('Quantità già completa');l.done++;changed=true;
    }else if(q.action==='undo'){own();var l=o.lines.find(function(x){return x.sku===normal(q.sku);});if(!l||!l.done)throw Error('Nessuna lettura da annullare');l.done--;changed=true;
    }else if(q.action==='release'){own();o.owner=null;changed=true;
    }else if(q.action==='close'){own();if(!q.operator||!o.lines.every(function(l){return l.done===l.qty;}))throw Error('Verifica incompleta');o.closed=true;o.operator=String(q.operator);o.date=new Date().toISOString();o.owner=null;changed=true;
    }else if(q.action!=='pull')throw Error('Operazione sconosciuta');
    if(changed)persist(id,o);SpreadsheetApp.flush();
    // Modern scanners receive only the changed order; older devices and PCs keep the full response.
    if(q.compact===true&&changed&&['claim','scan','undo','release','close'].indexOf(q.action)>=0)return reply({ok:true,delta:true,id:id,order:o,serverTime:stamp});
    var visible=Object.create(null),expired=[];
    Object.keys(all).forEach(function(key){var item=all[key];if(item.expired){expired.push({id:key,date:item.expiredAt,lines:item.lines});}else visible[key]=item;});
    expired.sort(function(a,b){return String(b.date).localeCompare(String(a.date));});
    return reply({ok:true,catalog:catalog,orders:visible,expired:expired.slice(0,100),serverTime:stamp});
  }catch(err){return reply({ok:false,error:String(err.message||err)});}finally{if(acquired)lock.releaseLock();}
}
function normal(x){return String(x==null?'':x).trim().toUpperCase();}
function reply(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);}
// Fast path: one order, one sheet row, no full catalog download or full order scan.
function compactOrder(q,ss,sheet){
  var now=Date.now(), stamp=new Date(now).toISOString(),id=normal(q.id),last=sheet.getLastRow();
  if(!id||last<2)throw Error('Ordine non disponibile');
  var cell=sheet.getRange(2,1,last-1,1).createTextFinder(id).matchEntireCell(true).matchCase(true).findNext();
  if(!cell)throw Error('Ordine non disponibile');
  var row=cell.getRow(), value=sheet.getRange(row,2),o=JSON.parse(value.getValue());
  function write(){value.setValue(JSON.stringify(o));SpreadsheetApp.flush();}
  if(!o.closed&&!o.expired){
    if(!Number.isFinite(Date.parse(o.receivedAt))){o.receivedAt=stamp;write();}
    if(now-Date.parse(o.receivedAt)>=36*60*60*1000){o.expired=true;o.expiredAt=new Date(Date.parse(o.receivedAt)+36*60*60*1000).toISOString();o.owner=null;write();}
  }
  if(o.expired)throw Error('Ordine scaduto dopo 36 ore');
  if(o.closed)throw Error('Ordine non disponibile');
  if(q.action==='claim'){if(o.owner&&o.owner!==q.device)throw Error('Ordine in lavorazione su un altro dispositivo');o.owner=q.device;}
  else{
    if(o.owner!==q.device)throw Error('Ordine non assegnato a questo dispositivo');
    if(q.action==='scan'){
      var code=normal(q.code),aliasMap=Object.create(null),aliases=ss.getSheetByName('CARCODE_SCANNER_BARCODE');if(!code)throw Error('Barcode vuoto');
      if(aliases&&aliases.getLastRow()>1){var a=aliases.getRange(2,1,aliases.getLastRow()-1,2).getDisplayValues();a.forEach(function(r){aliasMap[normal(r[0])]=normal(r[1]);});}
      var candidate=o.lines.filter(function(l){return aliasMap[l.sku]===code;});
      var existing=Object.create(null);
      if(candidate.length){var source=ss.getSheets()[0].getDataRange().getDisplayValues();for(var j=1;j<source.length;j++)if(source[j][0]&&source[j][1])existing[normal(source[j][0])]=true;}
      var matches=o.lines.filter(function(l){return l.sku===code||(existing[l.sku]&&aliasMap[l.sku]===code);});
      if(matches.length!==1)throw Error('Prodotto non previsto o barcode ambiguo');var line=matches[0];if(line.done>=line.qty)throw Error('Quantità già completa');line.done++;
    }else if(q.action==='undo'){var line=o.lines.find(function(l){return l.sku===normal(q.sku);});if(!line||!line.done)throw Error('Nessuna lettura da annullare');line.done--;}
    else if(q.action==='release')o.owner=null;
    else if(q.action==='close'){if(!q.operator||!o.lines.every(function(l){return l.done===l.qty;}))throw Error('Verifica incompleta');o.closed=true;o.operator=String(q.operator);o.date=stamp;o.owner=null;}
  }
  write();return reply({ok:true,delta:true,id:id,order:o,serverTime:stamp});
}
