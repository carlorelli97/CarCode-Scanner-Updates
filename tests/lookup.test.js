// Run with: node tests/lookup.test.js
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('app/src/main/assets/lookup.js','utf8');
const start=code.indexOf('function relatedIds('),end=code.indexOf('function drawLookup(');
assert.ok(start>=0&&end>start);
const state={catalog:{'SKU-A':{variant:'Rosso L',ean:'0123456789012'},'SKU-B':{variant:'Nero M',ean:'9988776655443'}},orders:{
 '101':{lines:[{sku:'SKU-A',qty:2,done:1,alerts:'DOPPIO ORDINE [102]'},{sku:'SKU-B',qty:1,done:0}]},
 '102':{lines:[{sku:'SKU-A',qty:1,done:0,alerts:'DOPPIO ORDINE [101]'}]},
 '103':{lines:[{sku:'SKU-B',qty:3,done:0}]}
}};
const ctx={state,norm:s=>String(s??'').trim().toUpperCase()};vm.createContext(ctx);vm.runInContext(code.slice(start,end),ctx);
const ids=x=>Array.from(ctx.resultsFor(x).ids);
assert.deepEqual(ids('101'),['101','102'],'order should show its linked double');
assert.deepEqual(ids('sku-a'),['101','102'],'SKU matches all orders');
assert.deepEqual(ids('0123456789012'),['101','102'],'EAN13 matches all orders');
assert.deepEqual(ids('123456789012'),['101','102'],'UPC-A matches EAN13 with leading zero');
assert.deepEqual(ids('9988776655443'),['101','103'],'second EAN matches all orders');
assert.deepEqual(ids('9999999999999'),[],'unknown EAN returns no match');
assert.deepEqual(ids(' 102 '),['102','101'],'exact order precedence');
assert.equal(ctx.codeMatches({sku:'SKU-A',ean:'4812345678901'},'4812345678901'),true,'EAN direct on order line');
assert.equal(state.orders['101'].lines[0].done,1,'search must not change verified quantities');
console.log('PASS: order, doubles, SKU, EAN, UPC-A, multiple matches, unknown codes, read-only');
