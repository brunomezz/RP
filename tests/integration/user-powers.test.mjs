import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHarness} from './harness.mjs';
import {createERPHandler} from '../../shared/api.mjs';
const body={action:'create',work:'ELYSIUM',purpose:'Poder individual',items:[{kind:'material',material:'bloco',qty:1,service:'alvenaria',neededDate:'2026-11-10',location:'Torre A'}]};
async function get(h,path,c){const r=await h.fetch(path,c);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function post(h,path,c,p,key=crypto.randomUUID()){return h.fetch(path,c,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(p)});}
async function change(h,c,p){const s=await get(h,'/api/security',c);const r=await post(h,'/api/security',c,{revision:s.revision,reason:'Configuração explícita do teste',...p});assert.equal(r.status,200,await r.clone().text());}
const user=(id,memberships,overrides=[],admin=false)=>({action:'user',userId:id,email:'',disabled:false,admin,memberships,overrides});
const link=(workId,role)=>({workId,role});const power=(workId,permission,effect)=>({workId,permission,effect});

test('Admin tem acesso total atual e futuro, mantém etapas e não pode ser reduzido como cargo',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),e=await h.login('user2');
  await change(h,a,{action:'role',role:'engenharia',permissions:[]});
  let r=await post(h,'/api/commands',a,body);assert.equal(r.status,200);const {id}=await r.json();
  let state=await get(h,'/api/state',a),record=state.requests.find(r=>r.id===id);
  const outOfStage=await post(h,'/api/commands',a,{action:'director',id,expectedRevision:record.revision,decisions:['not-a-quote'],arrivals:['2026-11-10']});assert.equal(outOfStage.status,400);assert.match((await outOfStage.json()).error,/fora da etapa/);assert.equal((await get(h,'/api/state',a)).orders.length,0);
  r=await post(h,'/api/commands',a,{action:'engineering',id,expectedRevision:record.revision,services:['alvenaria']});assert.equal(r.status,200,await r.clone().text());
  await change(h,a,{action:'work',workId:'FUTURA',name:'Obra futura'});assert.ok((await get(h,'/api/session',a)).access.some(m=>m.work_id==='FUTURA'&&m.role==='admin'));
  const s=await get(h,'/api/security',a);assert.equal((await post(h,'/api/security',a,{action:'role',role:'admin',permissions:[],reason:'Reduzir Admin',revision:s.revision})).status,400);
  assert.equal((await post(h,'/api/security',e,{...user('test-engineer',[],[],true),revision:s.revision,reason:'Autopromoção'})).status,403);
 }finally{await h.close();}
});

test('poder individual permite só a pessoa/obra, bloqueio domina vários cargos e herança acompanha mudanças',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),e=await h.login('user2'),other=await h.login('unassigned');
  await change(h,a,user('test-unassigned',[link('ELYSIUM','engenharia')]));
  await change(h,a,user('test-engineer',[link('ELYSIUM','engenharia'),link('BLEND','engenharia')],[power('ELYSIUM','create','allow')]));
  assert.equal((await post(h,'/api/commands',e,body)).status,200);assert.equal((await post(h,'/api/commands',other,body)).status,403);assert.equal((await post(h,'/api/commands',e,{...body,work:'BLEND'})).status,403);
  await change(h,a,user('test-engineer',[link('ELYSIUM','engenharia'),link('ELYSIUM','almoxarifado')],[power('ELYSIUM','create','deny')]));
  assert.equal((await post(h,'/api/commands',e,body)).status,403);
  await change(h,a,user('test-engineer',[link('ELYSIUM','engenharia')],[]));assert.equal((await post(h,'/api/commands',e,body)).status,403);
  await change(h,a,{action:'role',role:'engenharia',permissions:['create']});assert.equal((await post(h,'/api/commands',e,body)).status,200);assert.equal((await post(h,'/api/commands',other,body)).status,200);
  const s=await get(h,'/api/security',a);const audit=s.audit.find(row=>JSON.parse(row.after_json)?.overrides?.some(p=>p.effect==='deny'));assert.ok(audit);assert.equal(audit.actor_id,'test-admin');
 }finally{await h.close();}
});

test('exceções exigem obra liberada, ação conhecida, unicidade; Admin não aceita exceções',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),s=await get(h,'/api/security',a);
  for(const overrides of [[null],[power('BLEND','create','allow')],[power('ELYSIUM','securityAdmin','allow')],[power('ELYSIUM','create','other')],[power('ELYSIUM','create','allow'),power('ELYSIUM','create','deny')]]){
   const r=await post(h,'/api/security',a,{...user('test-engineer',[link('ELYSIUM','engenharia')],overrides),revision:s.revision,reason:'Inválido'});assert.equal(r.status,400,await r.clone().text());
  }
  assert.equal((await post(h,'/api/security',a,{...user('test-engineer',[link('ELYSIUM','engenharia')],[power('ELYSIUM','create','deny')],true),revision:s.revision,reason:'Inválido'})).status,400);
  assert.equal((await get(h,'/api/security',a)).revision,s.revision);
 }finally{await h.close();}
});

test('revogar exceção durante comando impede commit com poderes antigos',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin');await h.login('user2');await change(h,a,user('test-engineer',[link('ELYSIUM','engenharia')],[power('ELYSIUM','create','allow')]));
  let queued=false,intercepted=false;const db={prepare:sql=>{if(sql.startsWith('UPDATE erp_state'))queued=true;return h.db.prepare(sql);},batch:async statements=>{if(queued&&!intercepted){intercepted=true;queued=false;await change(h,a,user('test-engineer',[link('ELYSIUM','engenharia')],[power('ELYSIUM','create','deny')]));}return h.db.batch(statements);}};
  const api=createERPHandler(async()=>({id:'test-engineer',name:'Engenharia'}));const r=await api(new Request('http://erp.test/api/commands',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)}),{DB:db,BUCKET:{}});
  assert.equal(intercepted,true);assert.equal(r.status,403);assert.equal(JSON.parse((await h.db.prepare('SELECT data FROM erp_state WHERE id=1').first()).data).requests.length,0);
 }finally{await h.close();}
});

test('exceções persistem no reinício/migração, não liberam obra removida; relatórios respeitam poder efetivo',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fes-powers-'));let h;try{
  h=await createHarness(dir);let a=await h.login('admin'),e=await h.login('user2');
  await change(h,a,{...user('test-engineer',[link('ELYSIUM','engenharia')],[power('ELYSIUM','reportsExport','deny')]),email:'engineer@example.test'});
  assert.equal((await h.fetch('/api/reports?work=ELYSIUM&stage=solicitacoes',e)).status,403);assert.equal((await get(h,'/api/reports/recipients?work=ELYSIUM',a)).some(u=>u.id==='test-engineer'),false);
  await h.close();h=await createHarness(dir);a=await h.login('admin');e=await h.login('user2');
  const sql=await readFile(new URL('../../migrations/0004_user_powers.sql',import.meta.url),'utf8');await h.db.batch(sql.split(';').filter(s=>s.trim()).map(s=>h.db.prepare(s)));
  assert.equal((await h.fetch('/api/reports?work=ELYSIUM&stage=solicitacoes',e)).status,403);
  await change(h,a,{...user('test-admin',[],[],true),email:'admin@example.test'});assert.ok((await get(h,'/api/reports/recipients?work=ELYSIUM',e)).some(u=>u.id==='test-admin'));
  await change(h,a,user('test-engineer',[],[]));assert.equal((await h.fetch('/api/session',e)).status,403);assert.equal((await h.db.prepare("SELECT COUNT(*) AS n FROM user_permissions WHERE user_id='test-engineer'").first()).n,0);
 }finally{if(h)await h.close();await rm(dir,{recursive:true,force:true});}
});
