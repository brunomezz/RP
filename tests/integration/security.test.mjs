import test from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from './harness.mjs';
import { createERPHandler } from '../../shared/api.mjs';
const item={kind:'material',material:'bloco',qty:1,service:'alvenaria',neededDate:'2026-11-10',location:'Torre A'};
async function get(h,path,c){const r=await h.fetch(path,c);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function post(h,path,c,body,key=crypto.randomUUID()){return h.fetch(path,c,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});}
async function change(h,c,body){const s=await get(h,'/api/security',c);const r=await post(h,'/api/security',c,{revision:s.revision,reason:'Teste de configuração explícita',...body});assert.equal(r.status,200,await r.clone().text());return r.json();}
const user=(userId,memberships=[],admin=false,disabled=false)=>({action:'user',userId,memberships,admin,disabled});
const create={action:'create',work:'ELYSIUM',purpose:'Teste de poderes',items:[item]};

test('admin sem obra configura segurança; não admin e origem externa não administram nem se promovem',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),u=await h.login('user1');
  const session=await get(h,'/api/session',a);assert.equal(session.isAdmin,true);assert.deepEqual(session.access,[]);
  const state=await get(h,'/api/state',a);assert.deepEqual(state.catalog,[]);assert.deepEqual(state.works,[]);
  assert.equal((await post(h,'/api/commands',a,create)).status,403);
  assert.equal((await h.fetch('/api/security',u)).status,403);
  assert.equal((await post(h,'/api/security',u,{...user('test-almox',[],true),revision:0,reason:'Promoção forjada'})).status,403);
  assert.equal((await h.fetch('/api/security',a,{method:'POST',headers:{Origin:'https://other.test'},body:'{}'})).status,403);
  assert.equal((await h.fetch('/api/security')).status,401);
 }finally{await h.close();}
});

test('liberação real de usuário pendente, cargos cumulativos por obra, suspensão e reativação na mesma sessão',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),u=await h.login('unassigned');
  assert.equal((await get(h,'/api/identity',u)).id,'test-unassigned');
  assert.equal((await h.fetch('/api/session',u)).status,403);
  await change(h,a,user('test-unassigned',[{workId:'ELYSIUM',role:'almoxarifado'},{workId:'ELYSIUM',role:'engenharia'}]));
  const session=await get(h,'/api/session',u);assert.equal(session.access.length,2);
  assert.equal((await post(h,'/api/commands',u,create)).status,200);
  assert.equal((await post(h,'/api/commands',u,{...create,work:'BLEND'})).status,403);
  await change(h,a,user('test-unassigned',[],false,true));
  const blocked=await h.fetch('/api/state',u);assert.equal(blocked.status,403);assert.equal((await blocked.json()).code,'ACCOUNT_DISABLED');
  await get(h,'/api/identity',u);assert.equal((await h.fetch('/api/session',u)).status,403); // Login never clears suspension.
  await change(h,a,user('test-unassigned',[{workId:'BLEND',role:'almoxarifado'}]));
  assert.deepEqual((await get(h,'/api/state',u)).requests,[]);
 }finally{await h.close();}
});

test('poder configurável é aplicado pela API imediatamente, sem promover o cargo ou ignorar a etapa',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),u=await h.login('user2');
  assert.equal((await post(h,'/api/commands',u,create)).status,403);
  await change(h,a,{action:'role',role:'engenharia',permissions:['create']});
  const r=await post(h,'/api/commands',u,create);assert.equal(r.status,200);const {id}=await r.json();
  assert.equal((await post(h,'/api/commands',u,{action:'engineering',id,expectedRevision:0,services:['alvenaria']})).status,403);
  await change(h,a,{action:'role',role:'engenharia',permissions:['director']});
  const denied=await post(h,'/api/commands',u,{action:'director',id,expectedRevision:1,decisions:[],arrivals:[]});assert.notEqual(denied.status,200);
  assert.equal((await post(h,'/api/commands',u,create)).status,403);
  const snapshot=await get(h,'/api/security',a);assert.equal(snapshot.audit.length,2);assert.equal(snapshot.audit[0].actor_id,'test-admin');assert.ok(snapshot.audit[0].reason);
 }finally{await h.close();}
});

test('último administrador é protegido mesmo com remoções concorrentes',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),b=await h.login('user2');
  const s=await get(h,'/api/security',a);
  assert.equal((await post(h,'/api/security',a,{...user('test-admin'),revision:s.revision,reason:'Remover último'})).status,409);
  assert.equal((await post(h,'/api/security',a,{...user('test-admin',[],true,true),revision:s.revision,reason:'Suspender último'})).status,409);
  await change(h,a,user('test-engineer',[],true));
  const {revision}=await get(h,'/api/security',a);
  const results=await Promise.all([post(h,'/api/security',a,{...user('test-admin'),revision,reason:'Remover A'}),post(h,'/api/security',b,{...user('test-engineer'),revision,reason:'Remover B'})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM security_admins a JOIN security_users u ON u.id=a.user_id WHERE u.disabled=0').first()).count,1);
 }finally{await h.close();}
});

test('alterações têm motivo, revisão, idempotência e histórico atômico; valores desconhecidos são recusados',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),{revision}=await get(h,'/api/security',a),key=crypto.randomUUID();
  const body={action:'role',role:'engenharia',permissions:['measure'],reason:'Restringir medição',revision};
  const results=await Promise.all([post(h,'/api/security',a,body,key),post(h,'/api/security',a,body,key)]);
  assert.ok(results.some(r=>r.status===200));assert.ok(results.every(r=>[200,409].includes(r.status)));
  assert.equal((await post(h,'/api/security',a,body,key)).status,200);
  let s=await get(h,'/api/security',a);assert.equal(s.audit.length,1);assert.equal(s.revision,revision+1);assert.deepEqual(JSON.parse(s.audit[0].after_json),['measure']);
  assert.equal((await post(h,'/api/security',a,{...body,permissions:['create']},key)).status,409);
  assert.equal((await post(h,'/api/security',a,{...body,revision:s.revision,reason:''})).status,400);
  assert.equal((await post(h,'/api/security',a,{...body,revision:s.revision,permissions:['securityAdmin']})).status,400);
  assert.equal((await post(h,'/api/security',a,{...body,revision:s.revision,role:'inventado'})).status,400);
  assert.equal((await post(h,'/api/security',a,{...body,permissions:['create']})).status,409);
 }finally{await h.close();}
});

test('revogação durante um comando impede que a autorização antiga confirme a escrita',async()=>{
 const h=await createHarness();try{
  const admin=await h.login('admin');let intercepted=false;
  const db={prepare:sql=>h.db.prepare(sql),batch:async statements=>{
   // The operational write batch has state, operation and audit (3 statements).
   if(!intercepted&&statements.length===3){intercepted=true;await change(h,admin,{action:'role',role:'almoxarifado',permissions:[]});}
   return h.db.batch(statements);
  }};
  const api=createERPHandler(async()=>({id:'test-almox',name:'Teste · Almoxarifado'}));
  const r=await api(new Request('http://erp.test/api/commands',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(create)}),{DB:db,BUCKET:{}});
  assert.ok(intercepted);assert.equal(r.status,403);const row=await h.db.prepare('SELECT data FROM erp_state WHERE id=1').first();assert.deepEqual(JSON.parse(row.data).requests,[]);
  assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM audit').first()).count,0);
 }finally{await h.close();}
});

test('obra criada sem substituir registros; permissões de anexos acompanham o cargo',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin'),u=await h.login('user1'),e=await h.login('user2'),p=await h.login('procurement');
  const r=await post(h,'/api/commands',u,create),{id}=await r.json();
  await post(h,'/api/commands',e,{action:'engineering',id,expectedRevision:1,services:['alvenaria']});
  await change(h,a,{action:'work',workId:'NOVA',name:'Obra nova'});
  assert.equal((await get(h,'/api/state',u)).requests.length,1);
  await change(h,a,user('test-unassigned',[{workId:'NOVA',role:'engenharia'}]));const n=await h.login('unassigned');
  const state=await get(h,'/api/state',n);assert.equal(state.works[0].id,'NOVA');assert.equal(state.budgetServices.NOVA[0].id,'nao-previsto');
  await change(h,a,{action:'role',role:'suprimentos',permissions:['quoteFiles']});
  const file={targetKind:'request',targetId:id,purpose:'quoteFiles',name:'teste.txt',size:3};
  const reserved=await post(h,'/api/files',p,file);assert.equal(reserved.status,201,await reserved.clone().text());const f=await reserved.json();
  assert.equal((await post(h,'/api/files',p,{...file,purpose:'quote'})).status,403);
  await change(h,a,{action:'role',role:'suprimentos',permissions:[]});
  assert.equal((await h.fetch('/api/files/'+f.id,p,{method:'PUT',body:'abc'})).status,403);
  await h.db.prepare("UPDATE erp_state SET data=json_set(data,'$.testPadding',?) WHERE id=1").bind('x'.repeat(1024*1024)).run();
  const security=await get(h,'/api/security',a);
  const full=await post(h,'/api/security',a,{action:'work',workId:'OVERFLOW',name:'Não gravar',revision:security.revision,reason:'Verificar limite'});
  assert.equal(full.status,413);assert.equal((await get(h,'/api/security',a)).works.some(w=>w.id==='OVERFLOW'),false);

 }finally{await h.close();}
});

test('reinício e reaplicação da migração não restauram permissões revogadas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'fes-security-'));let h;
 try{
  h=await createHarness(dir);const a=await h.login('admin');
  await change(h,a,{action:'role',role:'engenharia',permissions:[]});await change(h,a,user('test-almox'));
  const schema=await readFile(new URL('../../migrations/0002_security.sql',import.meta.url),'utf8');await h.db.batch(schema.split(';').filter(s=>s.trim()).map(s=>h.db.prepare(s)));
  assert.equal((await get(h,'/api/security',a)).grants.filter(g=>g.role==='engenharia').length,0);
  await h.close();h=await createHarness(dir);
  assert.equal((await h.fetch('/api/session',await h.login('user1'))).status,403);
  const s=await get(h,'/api/session',await h.login('user2'));assert.deepEqual(s.access[0].permissions,[]);
 }finally{if(h)await h.close();await rm(dir,{recursive:true,force:true});}
});

test('migração pendente é identificada sem conceder acesso nem expor erro SQL',async()=>{
 const h=await createHarness();try{
  const a=await h.login('admin');await h.db.prepare('DROP TABLE role_permissions').run();
  const response=await h.fetch('/api/session',a);assert.equal(response.status,503);const error=await response.json();assert.equal(error.code,'ERP_SETUP_REQUIRED');assert.ok(!error.error.includes('role_permissions'));
 }finally{await h.close();}
});

test('primeiro admin exige identidade escolhida e reconhecida; script não promove visitantes nem restaura admins',async()=>{
 const h=await createHarness();try{
  await h.db.prepare('DELETE FROM security_admins').run();
  const run=async id=>{const sql=execFileSync(process.execPath,['scripts/bootstrap-admin.mjs',id],{encoding:'utf8'});await h.db.batch(sql.split(';').filter(s=>s.trim()).map(s=>h.db.prepare(s)));};
  await run('identidade-nao-reconhecida');assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM security_admins').first()).count,0);
  await run('test-unassigned');const u=await h.login('unassigned');assert.equal((await get(h,'/api/session',u)).isAdmin,true);
  await run('test-admin');assert.equal((await h.db.prepare('SELECT COUNT(*) AS count FROM security_admins').first()).count,1);
  const audit=(await get(h,'/api/security',u)).audit;assert.equal(audit.length,1);assert.equal(audit[0].actor_id,'setup:operator');
 }finally{await h.close();}
});
