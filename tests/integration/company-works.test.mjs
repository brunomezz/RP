import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHarness} from './harness.mjs';
async function get(h,path,c){const r=await h.fetch(path,c);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function post(h,path,c,body,key=crypto.randomUUID()){return h.fetch(path,c,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});}
async function change(h,c,body,key){const s=await get(h,'/api/security',c);return post(h,'/api/security',c,{...body,reason:'Cadastro único da empresa no teste',revision:s.revision},key);}
const person=(userId,roles)=>({action:'user',userId,roles,admin:false,disabled:false,overrides:[]});

test('obra cadastrada uma vez aparece para todos; código automático, duplicidade e cargos validados',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),cookies=await Promise.all(['user1','user2','procurement','director','restricted'].map(p=>h.login(p)));
  const r=await change(h,a,{action:'work',name:'Edifício Árvore'});assert.equal(r.status,200,await r.clone().text());
  for(const c of cookies){const s=await get(h,'/api/state',c);assert.equal(s.works.filter(w=>w.id==='EDIFICIO-ARVORE').length,1);}
  const request={action:'create',work:'EDIFICIO-ARVORE',purpose:'Compra da obra única',items:[{kind:'material',material:'bloco',qty:1,service:'',neededDate:'2026-11-10',location:'Torre A'}]};
  const created=await post(h,'/api/commands',cookies[0],request);assert.equal(created.status,200,await created.clone().text());const {id}=await created.json();
  assert.ok((await get(h,'/api/state',cookies[1])).requests.some(r=>r.id===id));assert.equal((await post(h,'/api/commands',cookies[2],request)).status,403);
  assert.equal((await change(h,a,{action:'work',name:' edifício árvore ',workId:'OUTRO_CODIGO'})).status,400);
  assert.equal((await change(h,a,{action:'work',name:'Outra obra',workId:'edificio-arvore'})).status,400);
  const pending=await h.login('unassigned');assert.equal((await h.fetch('/api/state',pending)).status,403);
 }finally{await h.close();}
});

test('cargo pode ser definido sem obra; obra futura e troca de cargo atualizam todos atomicamente',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),u=await h.login('unassigned');
  await h.db.batch([h.db.prepare('DELETE FROM user_permissions'),h.db.prepare('DELETE FROM memberships'),h.db.prepare('DELETE FROM works')]);
  const r=await change(h,a,person('test-unassigned',['engenharia']));assert.equal(r.status,200,await r.clone().text());
  const session=await get(h,'/api/session',u);assert.deepEqual(session.roles,['engenharia']);assert.deepEqual(session.access,[]);
  assert.equal((await change(h,a,{action:'work',name:'Obra futura sem vínculo manual'})).status,200);
  assert.equal((await get(h,'/api/state',u)).works.length,1);assert.ok((await get(h,'/api/session',u)).access[0].permissions.includes('engineering'));
  assert.equal((await change(h,a,person('test-unassigned',['almoxarifado']))).status,200);
  const newer=await get(h,'/api/session',u);assert.ok(newer.access.every(m=>m.permissions.includes('create')&&!m.permissions.includes('engineering')));
  assert.equal((await change(h,a,person('test-unassigned',[]))).status,200);assert.equal((await h.fetch('/api/session',u)).status,403);
 }finally{await h.close();}
});

test('migração preserva obras/dados e papéis; reinício/reaplicação não restaura cargo removido',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fes-company-'));let h;try{
  h=await createHarness(dir);let a=await h.login('admin'),u=await h.login('user2');
  // Reconstruct the legacy per-work configuration, then apply the actual migration.
  await h.db.batch([h.db.prepare("DELETE FROM security_migrations WHERE id='company-works'"),h.db.prepare('DELETE FROM user_roles'),h.db.prepare('DELETE FROM memberships'),h.db.prepare("INSERT INTO memberships(user_id,work_id,role) VALUES('test-engineer','ELYSIUM','engenharia')")]);
  const sql=await readFile(new URL('../../migrations/0005_company_works.sql',import.meta.url),'utf8');const migrate=()=>h.db.batch(sql.split(';').filter(s=>s.trim()).map(s=>h.db.prepare(s)));
  const before=await h.db.prepare('SELECT data FROM erp_state WHERE id=1').first();await migrate();assert.deepEqual((await get(h,'/api/state',u)).works.map(w=>w.id).sort(),['BLEND','ELYSIUM']);
  assert.equal((await h.db.prepare('SELECT data FROM erp_state WHERE id=1').first()).data,before.data);
  assert.equal((await change(h,a,person('test-engineer',[]))).status,200);await migrate();assert.equal((await h.fetch('/api/session',u)).status,403);
  await h.close();h=await createHarness(dir);u=await h.login('user2');assert.equal((await h.fetch('/api/session',u)).status,403);
 }finally{if(h)await h.close();await rm(dir,{recursive:true,force:true});}
});

test('cadastro simultâneo/repetido tem uma obra; obra e cargo concorrentes não perdem vínculos',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),u=await h.login('unassigned'),s=await get(h,'/api/security',a),key=crypto.randomUUID();const body={action:'work',name:'Obra simultânea',reason:'Teste de concorrência',revision:s.revision};
  const r=await Promise.all([post(h,'/api/security',a,body,key),post(h,'/api/security',a,body,key)]);assert.ok(r.some(r=>r.status===200));assert.ok(r.every(r=>[200,409].includes(r.status)));
  assert.equal((await get(h,'/api/security',a)).works.filter(w=>w.name==='Obra simultânea').length,1);
  const now=await get(h,'/api/security',a);const results=await Promise.all([post(h,'/api/security',a,{...person('test-unassigned',['engenharia']),reason:'Cargo',revision:now.revision}),post(h,'/api/security',a,{action:'work',name:'Obra concorrente ao cargo',reason:'Obra',revision:now.revision})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  if(results[0].status!==200)assert.equal((await change(h,a,person('test-unassigned',['engenharia']))).status,200);
  if(results[1].status!==200)assert.equal((await change(h,a,{action:'work',name:'Obra concorrente ao cargo'})).status,200);
  const userState=await get(h,'/api/state',u);assert.equal(userState.works.length,(await get(h,'/api/security',a)).works.length);
 }finally{await h.close();}
});
