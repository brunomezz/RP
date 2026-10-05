import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './harness.mjs';
async function command(h,c,body){return h.fetch('/api/commands',c,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)});}
async function ok(h,c,body){const r=await command(h,c,body);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function state(h,c){return (await h.fetch('/api/state',c)).json();}
const today=new Date().toISOString().slice(0,10);
async function rev(h,c){return (await state(h,c)).revision;}
test('locais, saldo inicial, reserva, saída pela reserva, transferência e devolução respeitam o disponível',async()=>{
 const h=await createHarness();
 try{
  const a=await h.login('user1'),e=await h.login('user2'),d=await h.login('director'),adm=await h.login('admin');
  await ok(h,a,{action:'location',work:'ELYSIUM',name:'Almoxarifado central'});
  await ok(h,a,{action:'location',work:'ELYSIUM',name:'Container 2'});
  assert.equal((await command(h,a,{action:'location',work:'ELYSIUM',name:'almoxarifado CENTRAL'})).status,409);
  let s=await state(h,a);const [central,container]=s.locations.map(l=>l.id);
  assert.equal((await command(h,a,{action:'stockInit',work:'ELYSIUM',material:'bloco',qty:100,date:today,expectedStateRevision:s.revision})).status,400,'local obrigatório quando a obra tem locais');
  await ok(h,a,{action:'stockInit',work:'ELYSIUM',material:'bloco',qty:100,date:today,location:central,expectedStateRevision:s.revision});
  assert.equal((await command(h,a,{action:'stockInit',work:'ELYSIUM',material:'bloco',qty:5,date:today,location:central,expectedStateRevision:await rev(h,a)})).status,400,'um saldo inicial por insumo e local');
  const res=await ok(h,e,{action:'reserve',work:'ELYSIUM',material:'bloco',qty:60,location:central,service:'alvenaria',neededDate:'2026-11-10',note:'Torre A',expectedStateRevision:await rev(h,e)});
  assert.equal((await command(h,a,{action:'withdraw',work:'ELYSIUM',material:'bloco',qty:41,recipient:'Equipe',service:'alvenaria',location:central,expectedStateRevision:await rev(h,a)})).status,400,'saída livre não usa saldo reservado');
  await ok(h,a,{action:'withdraw',work:'ELYSIUM',material:'bloco',qty:50,recipient:'Equipe',service:'alvenaria',location:central,reservationId:res.id,expectedStateRevision:await rev(h,a)});
  s=await state(h,a);assert.equal(s.reservations[0].consumed,50);assert.equal(s.reservations[0].status,'active');
  await ok(h,e,{action:'release',reservationId:res.id,reason:'Etapa replanejada'});
  s=await state(h,a);assert.equal(s.reservations[0].status,'released');
  await ok(h,a,{action:'transfer',work:'ELYSIUM',toWork:'ELYSIUM',material:'bloco',qty:20,location:central,toLocation:container,expectedStateRevision:s.revision});
  assert.equal((await command(h,a,{action:'transfer',work:'ELYSIUM',toWork:'BLEND',material:'bloco',qty:31,location:central,expectedStateRevision:await rev(h,a)})).status,400,'transferência maior que o disponível');
  await ok(h,a,{action:'transfer',work:'ELYSIUM',toWork:'BLEND',material:'bloco',qty:30,location:central,expectedStateRevision:await rev(h,a)});
  s=await state(h,a);
  const bal=(w,l)=>s.movements.filter(m=>m.work===w&&(l===undefined||(m.location||'')===l)).reduce((v,m)=>v+(m.kind==='in'?m.qty:-m.qty),0);
  assert.equal(bal('ELYSIUM',central),0);assert.equal(bal('ELYSIUM',container),20);assert.equal(bal('BLEND'),30);
  const out=s.movements.find(m=>m.type==='withdraw');
  assert.equal((await command(h,a,{action:'stockReturn',work:'ELYSIUM',material:'bloco',qty:51,who:'Equipe',reason:'Sobra',location:central,returnOf:out.id,expectedStateRevision:s.revision})).status,400);
  await ok(h,a,{action:'stockReturn',work:'ELYSIUM',material:'bloco',qty:8,who:'Equipe',reason:'Sobra',location:central,returnOf:out.id,expectedStateRevision:s.revision});
  s=await state(h,a);assert.equal(s.movements.at(-1).type,'return');assert.equal(s.movements.at(-1).actorId,'test-almox');
  // fechamento: diretor fecha hoje, novos movimentos ficam bloqueados até reabrir
  assert.equal((await command(h,a,{action:'stockClose',work:'ELYSIUM',through:today})).status,403);
  await ok(h,d,{action:'stockClose',work:'ELYSIUM',through:today,note:'Mês'});
  s=await state(h,a);assert.equal(s.closings[0].balances.find(b=>b.material==='bloco').qty,28);
  assert.equal((await command(h,a,{action:'withdraw',work:'ELYSIUM',material:'bloco',qty:1,recipient:'Equipe',service:'alvenaria',location:container,expectedStateRevision:s.revision})).status,409);
  await ok(h,adm,{action:'stockReopen',work:'ELYSIUM',reason:'Lançamento atrasado'});
  await ok(h,a,{action:'withdraw',work:'ELYSIUM',material:'bloco',qty:1,recipient:'Equipe',service:'alvenaria',location:container,expectedStateRevision:await rev(h,a)});
  assert.equal((await command(h,a,{action:'location',work:'ELYSIUM',id:container,name:'Container 2',active:false})).status,409,'local com saldo não é desativado');
 }finally{await h.close();}
});
test('cadastros e movimentos ficam em tabelas próprias, fora do agregado',async()=>{
 const h=await createHarness();
 try{
  const p=await h.login('procurement');
  await ok(h,p,{action:'material',work:'ELYSIUM',name:'Areia',unit:'m³'});
  await ok(h,p,{action:'supplier',work:'ELYSIUM',name:'Fornecedor tabela'});
  const agg=JSON.parse((await h.db.prepare('SELECT data FROM erp_state WHERE id=1').first()).data);
  assert.equal(agg.catalog,undefined);assert.equal(agg.suppliers,undefined);assert.equal(agg.movements,undefined);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM catalog_items').first()).n,2);
  assert.equal((await h.db.prepare('SELECT COUNT(*) n FROM supplier_rows').first()).n,1);
  const s=await state(h,p);assert.deepEqual(s.catalog.map(m=>m.id).slice(0,1),['bloco']);
 }finally{await h.close();}
});
