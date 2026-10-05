import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHarness } from './harness.mjs';
const item={kind:'material',material:'bloco',qty:10,service:'alvenaria',neededDate:'2026-11-10',location:'Torre A'};
const requestBody={action:'create',work:'ELYSIUM',purpose:'Relatório de teste',items:[item]};
async function get(h,path,c){const r=await h.fetch(path,c);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function post(h,path,c,body,key=crypto.randomUUID()){return h.fetch(path,c,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});}
async function ok(h,c,body,key){const r=await post(h,'/api/commands',c,body,key);assert.equal(r.status,200,await r.clone().text());return r.json();}
async function current(h,c,id){return (await get(h,'/api/state',c)).requests.find(r=>r.id===id);}
async function setup(mail=false,path){const h=await createHarness(path,{mail});const c={a:await h.login('user1'),e:await h.login('user2'),p:await h.login('procurement'),d:await h.login('director'),admin:await h.login('admin'),x:await h.login('restricted')};return {h,c};}
async function grant(h,c,body){const s=await get(h,'/api/security',c);const r=await post(h,'/api/security',c,{revision:s.revision,reason:'Configuração de teste',...body});assert.equal(r.status,200,await r.clone().text());}
async function contact(h,c,id,email,work='ELYSIUM',role='engenharia'){return grant(h,c,{action:'user',userId:id,email,disabled:false,admin:false,memberships:[{workId:work,role}]});}
async function pdf(text='',pages=1){const d=await PDFDocument.create(),font=await d.embedFont(StandardFonts.Helvetica);for(let p=0;p<pages;p++){const page=d.addPage();if(p===0&&text)text.split('\n').forEach((line,n)=>page.drawText(line,{x:40,y:780-n*20,size:12,font}));}return d.save();}
async function upload(h,c,bytes,name='origem.pdf',work='ELYSIUM'){return h.fetch('/api/documents?'+new URLSearchParams({work,name}),c,{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes});}
async function workflow(h,c){
 const {id}=await ok(h,c.a,{...requestBody,items:[item,{kind:'service',name:'Execução',unit:'m²',qty:3,service:'alvenaria',neededDate:'2026-11-11',location:'Torre B'}]});let r=await current(h,c.e,id);
 await ok(h,c.e,{action:'engineering',id,expectedRevision:r.revision,services:['alvenaria','alvenaria']});r=await current(h,c.p,id);
 await ok(h,c.p,{action:'quote',id,expectedRevision:r.revision,supplier:'Fornecedor dos relatórios',prices:[12,20],freight:5,days:7,payment:'28 dias',scope:'Integral'});r=await current(h,c.p,id);
 await ok(h,c.p,{action:'suggest',id,expectedRevision:r.revision,allocations:[r.quotes[0].id,r.quotes[0].id]});r=await current(h,c.p,id);
 await ok(h,c.p,{action:'send',id,expectedRevision:r.revision,exception:'Fornecedor exclusivo no teste'});r=await current(h,c.d,id);
 await ok(h,c.d,{action:'director',id,expectedRevision:r.revision,decisions:[r.quotes[0].id,r.quotes[0].id],arrivals:['2026-11-10','2026-11-11']});const state=await get(h,'/api/state',c.a),o=state.orders.find(o=>o.requestId===id),contract=state.contracts.find(o=>o.requestId===id);
 await ok(h,c.a,{action:'receive',id:o.id,expectedRevision:o.revision,quantities:[2],nf:'NF teste',note:'Conferido'});
 await ok(h,c.e,{action:'measure',id:contract.id,expectedRevision:contract.revision,quantities:[1],period:'Etapa 1'});
 const stock=await get(h,'/api/state',c.a);await ok(h,c.a,{action:'withdraw',work:'ELYSIUM',material:'bloco',qty:1,recipient:'Retirante de teste',service:'alvenaria',expectedStateRevision:stock.revision});return id;
}

test('11 relatórios de etapas geram PDFs válidos, respeitam filtros, obra e revisão da prévia',async()=>{
 const {h,c}=await setup();try{
  await workflow(h,c);await ok(h,c.a,{...requestBody,purpose:'Pendência técnica'});
  const options=await get(h,'/api/reports/options',c.e);assert.equal(Object.keys(options.stages).length,11);
  for(const stage of Object.keys(options.stages)){
   const report=await get(h,'/api/reports?work=ELYSIUM&stage='+stage,c.e);assert.equal(report.work.id,'ELYSIUM');assert.equal(report.headers.length,report.rows[0]?.length||report.headers.length);
   const r=await h.fetch('/api/reports?work=ELYSIUM&stage='+stage+'&format=pdf&revision='+report.revision,c.e);assert.equal(r.status,200,await r.clone().text());assert.equal(r.headers.get('Content-Type'),'application/pdf');assert.ok((await PDFDocument.load(await r.arrayBuffer())).getPageCount()>0);
  }
  assert.equal((await get(h,'/api/reports?work=ELYSIUM&stage=estoque',c.e)).rows[0][3],'1');
  assert.equal((await get(h,'/api/reports?work=ELYSIUM&stage=solicitacoes&query=Inexistente',c.e)).rows.length,0);
  assert.equal((await h.fetch('/api/reports?work=BLEND&stage=solicitacoes',c.e)).status,403);
  assert.equal((await h.fetch('/api/reports?work=ELYSIUM&stage=orcamento&from=2026-01-01',c.e)).status,400);
  assert.equal((await h.fetch('/api/reports?work=ELYSIUM&stage=solicitacoes&from=2026-02-30',c.e)).status,400);
  const preview=await get(h,'/api/reports?work=ELYSIUM&stage=solicitacoes',c.e);await ok(h,c.a,requestBody);
  assert.equal((await h.fetch('/api/reports?work=ELYSIUM&stage=solicitacoes&format=pdf&revision='+preview.revision,c.e)).status,409);
 }finally{await h.close();}
});

test('notificações por pessoa, sem duplicação por cargo/clique; leitura própria, isolamento e reinício',async()=>{
 const path=await mkdtemp(join(tmpdir(),'fes-notices-'));let h;try{
  let c;({h,c}=await setup(false,path));const key=crypto.randomUUID();await ok(h,c.a,requestBody,key);await ok(h,c.a,requestBody,key);
  const e=await get(h,'/api/notifications',c.e),p=await get(h,'/api/notifications',c.p);assert.equal(e.items.length,1);assert.equal(p.items.length,1);assert.equal((await get(h,'/api/notifications',c.x)).items.length,0);
  await post(h,'/api/notifications/read',c.e,{id:p.items[0].id});assert.equal((await get(h,'/api/notifications',c.p)).unread,1);
  await post(h,'/api/notifications/read',c.e,{id:e.items[0].id});assert.equal((await get(h,'/api/notifications',c.e)).unread,0);
  await h.close();({h,c}=await setup(false,path));assert.equal((await get(h,'/api/notifications',c.e)).items[0].read_at!==null,true);
  await contact(h,c.admin,'test-engineer','engineer@example.test','BLEND');assert.equal((await get(h,'/api/notifications',c.e)).items.some(n=>n.work_id==='ELYSIUM'),false);
 }finally{if(h)await h.close();await rm(path,{recursive:true,force:true});}
});

test('importação de PDF extrai texto e sugestões; só confirmação cria solicitação; hash e origem impedem duplicação',async()=>{
 const {h,c}=await setup();try{
  const bytes=await pdf('Finalidade: Material da torre\nBloco · catálogo de teste ; 2 ; un ; 12,50');
  const results=await Promise.all([upload(h,c.a,bytes),upload(h,c.a,bytes)]);assert.ok(results.every(r=>[200,201].includes(r.status)),await results[0].clone().text());const ids=await Promise.all(results.map(r=>r.json()));assert.equal(ids[0].id,ids[1].id);const id=ids[0].id;
  const doc=await get(h,'/api/documents/'+id,c.e);assert.ok(doc.extracted_text.includes('Material da torre'));assert.equal(doc.suggestions.items[0].qty,2);assert.equal(doc.suggestions.items[0].price,12.5);assert.equal(doc.suggestions.items[0].material,'bloco');
  assert.equal((await get(h,'/api/state',c.a)).requests.length,0);
  const body={...requestBody,sourceDocumentId:id,items:[{...item,qty:2}],purpose:'Revisado pelo usuário'};const responses=await Promise.all([post(h,'/api/commands',c.a,body),post(h,'/api/commands',c.a,body)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const state=await get(h,'/api/state',c.e);assert.equal(state.requests.length,1);assert.equal(state.requests[0].sourceDocumentId,id);assert.equal(state.movements.length,0);
  const reviewed=await get(h,'/api/documents/'+id,c.e);assert.equal(reviewed.imported.actor_id,'test-almox');assert.equal(reviewed.linked_record_id,state.requests[0].id);
  const downloaded=await h.fetch('/api/documents/'+id+'/file',c.e);assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),bytes);
  assert.equal((await h.fetch('/api/documents/'+id,c.x)).status,403);assert.equal((await h.fetch('/api/documents/'+id+'/file')).status,401);
 }finally{await h.close();}
});

test('proposta extraída é revisada para um registro autorizado; documento não altera estoque nem pode ser consumido novamente',async()=>{
 const {h,c}=await setup();try{
  const {id}=await ok(h,c.a,requestBody);await ok(h,c.e,{action:'engineering',id,expectedRevision:1,services:['alvenaria']});
  const r=await upload(h,c.p,await pdf('Fornecedor: Fornecedor importado\nBloco · catálogo de teste ; 10 ; un ; 13'));assert.equal(r.status,201,await r.clone().text());const doc=(await r.json()).id;
  const link=await post(h,'/api/documents/'+doc+'/link',c.p,{kind:'request',recordId:id});assert.equal(link.status,200);
  const request=await current(h,c.p,id);await ok(h,c.p,{action:'quote',id,expectedRevision:request.revision,sourceDocumentId:doc,supplier:'Fornecedor importado',prices:[13],freight:0,days:7,payment:'28 dias',scope:'Revisado'});
  const state=await get(h,'/api/state',c.p);assert.equal(state.requests[0].quotes[0].sourceDocumentId,doc);assert.equal(state.orders.length,0);assert.equal(state.movements.length,0);
  assert.equal((await post(h,'/api/documents/'+doc+'/link',c.p,{kind:'request',recordId:id})).status,409);
 }finally{await h.close();}
});

test('PDF inválido, vazio, páginas e limite são recusados; PDF digitalizado fica aguardando revisão manual',async()=>{
 const {h,c}=await setup();try{
  assert.equal((await upload(h,c.a,new TextEncoder().encode('<html>não é PDF</html>'))).status,400);
  assert.equal((await upload(h,c.a,new Uint8Array())).status,400);
  assert.equal((await upload(h,c.a,new Uint8Array(10*1024*1024+1))).status,413);
  assert.equal((await upload(h,c.a,await pdf('',201))).status,413);
  const r=await upload(h,c.a,await pdf());assert.equal(r.status,201);const doc=await get(h,'/api/documents/'+(await r.json()).id,c.e);assert.equal(doc.extraction_status,'no_text');assert.deepEqual(doc.suggestions.items,[]);
  assert.equal((await get(h,'/api/state',c.a)).requests.length,0);
  await grant(h,c.admin,{action:'role',role:'almoxarifado',permissions:['create']});assert.equal((await upload(h,c.a,await pdf('Não importar'))).status,403);
 }finally{await h.close();}
});

test('envio sem configuração explica pendência; destinatários exigem e-mail, obra e poder de relatório',async()=>{
 const {h,c}=await setup();try{
  await contact(h,c.admin,'test-engineer','engineer@example.test');await contact(h,c.admin,'test-restricted','other@example.test','BLEND','almoxarifado');
  const list=await get(h,'/api/reports/recipients?work=ELYSIUM',c.a);assert.deepEqual(list.map(r=>r.id),['test-engineer']);
  const r=await post(h,'/api/reports/email',c.a,{work:'ELYSIUM',stage:'solicitacoes',recipientId:'test-engineer'});assert.equal(r.status,503);assert.equal((await r.json()).code,'EMAIL_NOT_CONFIGURED');assert.equal((await get(h,'/api/reports/emails',c.a)).length,0);
  await grant(h,c.admin,{action:'role',role:'engenharia',permissions:['engineering']});assert.deepEqual(await get(h,'/api/reports/recipients?work=ELYSIUM',c.a),[]);
 }finally{await h.close();}
});

test('e-mail com PDF usa destinatário cadastrado e envio idempotente; transporte é explicitamente simulado',async()=>{
 const {h,c}=await setup(true);try{
  await contact(h,c.admin,'test-engineer','engineer@example.test');await ok(h,c.a,requestBody);const body={work:'ELYSIUM',stage:'solicitacoes',recipientId:'test-engineer',message:'Confira o PDF'},key=crypto.randomUUID();
  const responses=await Promise.all([post(h,'/api/reports/email',c.a,body,key),post(h,'/api/reports/email',c.a,body,key)]);assert.ok(responses.every(r=>[200,409].includes(r.status)),await responses[0].clone().text());
  const r=await post(h,'/api/reports/email',c.a,body,key);assert.equal(r.status,200,await r.clone().text());const job=await r.json();assert.equal(job.status,'accepted');assert.equal(h.mail.accepted.size,1);assert.equal(h.mail.requests.length,1);
  const mail=h.mail.requests[0].body;assert.deepEqual(mail.to,['engineer@example.test']);assert.equal(mail.attachments[0].filename,'FeS-solicitacoes.pdf');assert.ok((await PDFDocument.load(Buffer.from(mail.attachments[0].content,'base64'))).getPageCount());
  assert.equal((await get(h,'/api/notifications',c.e)).items.some(n=>n.event_key==='mail:'+job.id),true);
  assert.equal((await post(h,'/api/reports/email',c.a,{...body,recipientId:'test-restricted'})).status,403);
  assert.equal((await post(h,'/api/reports/emails/'+job.id+'/retry',c.e,{})).status,403);
 }finally{await h.close();}
});

test('confirmação incerta repete o mesmo PDF/chave, não cria novo envio; não promete entrega na caixa',async()=>{
 const {h,c}=await setup(true);try{
  await contact(h,c.admin,'test-engineer','engineer@example.test');h.mail.mode='unknown';
  const r=await post(h,'/api/reports/email',c.a,{work:'ELYSIUM',stage:'solicitacoes',recipientId:'test-engineer'});assert.equal(r.status,200);const job=await r.json();assert.equal(job.status,'unknown');
  await ok(h,c.a,requestBody);h.mail.mode='accepted';const retry=await post(h,'/api/reports/emails/'+job.id+'/retry',c.a,{});assert.equal(retry.status,200,await retry.clone().text());assert.equal((await retry.json()).status,'accepted');assert.equal(h.mail.accepted.size,1);assert.deepEqual(h.mail.requests[0],h.mail.requests[1]);
  assert.equal((await get(h,'/api/reports/emails',c.a)).length,1);
 }finally{await h.close();}
});

test('envio interrompido respeita reserva, retoma após expirar e bloqueia repetição fora da janela segura',async()=>{
 const {h,c}=await setup(true);try{
  await contact(h,c.admin,'test-engineer','engineer@example.test');h.mail.mode='unknown';
  const r=await post(h,'/api/reports/email',c.a,{work:'ELYSIUM',stage:'solicitacoes',recipientId:'test-engineer'});const job=await r.json();assert.equal(job.status,'unknown');
  await h.db.prepare("UPDATE report_emails SET status='sending',lease_until=? WHERE id=?").bind(new Date(Date.now()+60000).toISOString(),job.id).run();
  assert.equal((await post(h,'/api/reports/emails/'+job.id+'/retry',c.a,{})).status,409);assert.equal(h.mail.requests.length,1);
  const jobs=await get(h,'/api/reports/emails',c.a);assert.ok(jobs[0].lease_until);
  await h.db.prepare('UPDATE report_emails SET lease_until=? WHERE id=?').bind(new Date(Date.now()-1000).toISOString(),job.id).run();h.mail.mode='accepted';
  assert.equal((await post(h,'/api/reports/emails/'+job.id+'/retry',c.a,{})).status,200);assert.equal(h.mail.accepted.size,1);
  h.mail.mode='unknown';const second=await (await post(h,'/api/reports/email',c.a,{work:'ELYSIUM',stage:'solicitacoes',recipientId:'test-engineer'})).json();
  await h.db.prepare('UPDATE report_emails SET created_at=? WHERE id=?').bind(new Date(Date.now()-24*3600000).toISOString(),second.id).run();const count=h.mail.requests.length;
  assert.equal((await post(h,'/api/reports/emails/'+second.id+'/retry',c.a,{})).status,409);assert.equal(h.mail.requests.length,count);
 }finally{await h.close();}
});

test('retirar poderes bloqueia API de relatórios/importação; migração ausente orienta configuração',async()=>{
 const {h,c}=await setup();try{
  const snapshot=await get(h,'/api/security',c.admin),permissions=snapshot.grants.filter(g=>g.role==='almoxarifado'&&!['reportsExport','reportsEmail','documentsImport'].includes(g.permission)).map(g=>g.permission);
  await grant(h,c.admin,{action:'role',role:'almoxarifado',permissions});
  assert.equal((await h.fetch('/api/reports?work=ELYSIUM&stage=solicitacoes&format=pdf',c.a)).status,403);
  assert.equal((await upload(h,c.a,new TextEncoder().encode('%PDF-invalid'))).status,403);
  await h.db.prepare('DROP TABLE notifications').run();const r=await h.fetch('/api/notifications',c.e);assert.equal(r.status,503);assert.equal((await r.json()).code,'ERP_SETUP_REQUIRED');
 }finally{await h.close();}
});
