import { allow, loadActor, securityError } from './security.mjs';
import { buildReport, reportStages } from './report-data.mjs';
import { reportPDF } from './report-pdf.mjs';
export const emailConfigured=env=>!!(env.RESEND_API_KEY&&env.REPORT_EMAIL_FROM);
const binaryBase64=bytes=>{let s='';for(let n=0;n<bytes.length;n+=8192)s+=String.fromCharCode(...bytes.subarray(n,n+8192));return btoa(s);};
async function recipient(db,id,work){
 const user=await db.prepare(`SELECT u.id,u.name,c.email FROM security_users u JOIN user_contacts c ON c.user_id=u.id
 WHERE u.id=? AND u.disabled=0 AND c.email<>'' AND EXISTS(SELECT 1 FROM memberships m JOIN role_permissions p ON p.role=m.role WHERE m.user_id=u.id AND m.work_id=? AND m.active=1 AND p.permission='reportsExport')`).bind(id,work).first();
 if(!user)securityError(403,'O destinatário precisa ter e-mail cadastrado, acesso à obra e poder de exportar relatórios.');return user;
}
async function reportContext(db,actor,params){
 const workId=params.work;allow(actor,workId,'reportsExport');const work=await db.prepare('SELECT id,name FROM works WHERE id=?').bind(workId).first();
 const row=await db.prepare('SELECT data,revision FROM erp_state WHERE id=1').first();
 if(params.revision!==undefined&&Number(params.revision)!==row.revision)securityError(409,'Os registros mudaram após a prévia. Gere o relatório novamente.');
 const state=JSON.parse(row.data);
 return {...buildReport(state,work,{stage:params.stage,from:params.from||'',to:params.to||'',query:String(params.query||'').slice(0,300)},actor),revision:row.revision};
}
function jobInfo(job){const {id,work_id,stage,recipient_id,recipient_email,status,provider_id,last_error,created_at,last_attempt,lease_until}=job;return {id,work_id,stage,recipient_id,recipient_email,status,provider_id,last_error,created_at,last_attempt,lease_until};}
async function dispatch(db,env,actor,job,fetcher){
 if(!emailConfigured(env))securityError(503,'Envio de e-mail não configurado neste ambiente.','EMAIL_NOT_CONFIGURED');
 allow(actor,job.work_id,'reportsEmail');allow(actor,job.work_id,'reportsExport');
 if(job.actor_id!==actor.id)securityError(403,'Você não pode reenviar este relatório.');
 if(job.status==='accepted')return jobInfo(job);
 if(Date.now()-Date.parse(job.created_at)>23*3600000)securityError(409,'Prazo seguro de repetição encerrado. Confira o envio com o administrador antes de iniciar outro.');
 const now=new Date().toISOString(),lease=new Date(Date.now()+60000).toISOString();
 const claim=await db.prepare("UPDATE report_emails SET status='sending',last_attempt=?,lease_until=? WHERE id=? AND status<>'accepted' AND (lease_until IS NULL OR lease_until<?)").bind(now,lease,job.id,now).run();
 if(!claim.meta.changes)securityError(409,'Este envio está em andamento. Atualize o histórico em alguns instantes.');
 try{
  actor=await loadActor(db,actor);allow(actor,job.work_id,'reportsEmail');allow(actor,job.work_id,'reportsExport');
  const to=await recipient(db,job.recipient_id,job.work_id);if(to.email!==job.recipient_email)securityError(409,'O e-mail do colaborador mudou. Confira o cadastro antes de iniciar outro envio.');
  const file=await env.BUCKET.get(job.pdf_key);if(!file)securityError(404,'PDF do envio indisponível.');
  const payload={...JSON.parse(job.payload),attachments:[{filename:'FeS-'+job.stage+'.pdf',content:binaryBase64(new Uint8Array(await file.arrayBuffer()))}]};
  const r=await fetcher(new Request('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'fes-report/'+job.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)}));
  if(!r.ok){const definitive=r.status>=400&&r.status<500&&![408,429].includes(r.status);throw Object.assign(Error(definitive?'O serviço recusou o envio. Confira remetente e configuração.':'Não foi possível confirmar o envio. Atualize e tente novamente pelo mesmo registro.'),{deliveryState:definitive?'failed':'unknown',status:502});}
  const data=await r.json();if(typeof data.id!=='string'||!data.id)throw Error('Resposta sem confirmação do serviço.');
  const at=new Date().toISOString();
  await db.batch([
   db.prepare("UPDATE report_emails SET status='accepted',provider_id=?,last_error=NULL,lease_until=NULL WHERE id=?").bind(data.id,job.id),
   db.prepare("INSERT OR IGNORE INTO notifications(id,user_id,work_id,page,title,message,created_at,event_key) VALUES(?,?,?,'central-relatorios','Relatório encaminhado por e-mail',?,?,?)").bind('mail:'+job.id,job.recipient_id,job.work_id,actor.name+' · '+reportStages[job.stage],at,'mail:'+job.id),
   db.prepare("INSERT OR IGNORE INTO communication_audit(id,actor_id,actor_name,work_id,action,target,created_at,detail) VALUES(?,?,?,?,'report-email',?,?,?)").bind('mail:'+job.id,actor.id,actor.name,job.work_id,job.id,at,'Aceito pelo serviço de e-mail; entrega na caixa não confirmada.'),
  ]);
  return jobInfo({...job,status:'accepted',provider_id:data.id,last_error:null});
 }catch(e){
  const status=e.deliveryState||(e.status&&e.status<500?'failed':'unknown');
  await db.prepare('UPDATE report_emails SET status=?,last_error=?,lease_until=NULL WHERE id=? AND status<>\'accepted\'').bind(status,e.status?e.message:'Não foi possível confirmar o envio. Repita somente pelo mesmo registro.',job.id).run();
  return jobInfo({...job,status,last_error:e.status?e.message:'Não foi possível confirmar o envio. Atualize o histórico e repita pelo mesmo registro.'});
 }
}
export async function reportRoutes(request,env,actor,{json,response,mailFetch=fetch}){
 const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/reports'))return null;
 if(path==='/api/reports/options'&&request.method==='GET')return response({stages:reportStages,emailConfigured:emailConfigured(env)});
 if(path==='/api/reports/recipients'&&request.method==='GET'){
  const work=url.searchParams.get('work');allow(actor,work,'reportsEmail');
  const rows=await env.DB.prepare(`SELECT DISTINCT u.id,u.name,c.email FROM security_users u JOIN user_contacts c ON c.user_id=u.id JOIN memberships m ON m.user_id=u.id JOIN role_permissions p ON p.role=m.role WHERE u.disabled=0 AND c.email<>'' AND m.work_id=? AND m.active=1 AND p.permission='reportsExport' ORDER BY u.name`).bind(work).all();return response(rows.results);
 }
 if(path==='/api/reports'&&request.method==='GET'){
  const params=Object.fromEntries(url.searchParams),report=await reportContext(env.DB,actor,params);
  if(params.format!=='pdf')return response(report);
  const bytes=await reportPDF(report);actor=await loadActor(env.DB,actor);allow(actor,params.work,'reportsExport');
  return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="FeS-${report.stage}.pdf"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }
 if(path==='/api/reports/emails'&&request.method==='GET'){
  const rows=await env.DB.prepare("SELECT * FROM report_emails e WHERE actor_id=? AND EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=? AND m.work_id=e.work_id AND m.active=1) ORDER BY created_at DESC LIMIT 100").bind(actor.id,actor.id).all();return response(rows.results.map(jobInfo));
 }
 if(path==='/api/reports/email'&&request.method==='POST'){
  const p=await json(request),key=request.headers.get('Idempotency-Key');if(!key||key.length>100)securityError(400,'Identificador de envio inválido.');
  allow(actor,p.work,'reportsEmail');allow(actor,p.work,'reportsExport');if(!emailConfigured(env))securityError(503,'Envio de e-mail não configurado neste ambiente.','EMAIL_NOT_CONFIGURED');
  if(typeof p.recipientId!=='string'||typeof(p.message||'')!=='string'||(p.message||'').length>2000)securityError(400,'Confira destinatário e mensagem.');
  const fingerprint=JSON.stringify(p);let job=await env.DB.prepare('SELECT * FROM report_emails WHERE actor_id=? AND request_key=?').bind(actor.id,key).first();
  if(job){if(job.fingerprint!==fingerprint)securityError(409,'Identificador reutilizado para outro envio.');return response(await dispatch(env.DB,env,actor,job,mailFetch));}
  const to=await recipient(env.DB,p.recipientId,p.work),report=await reportContext(env.DB,actor,p),pdf=await reportPDF(report),id=crypto.randomUUID(),pdfKey='reports/'+id;
  const payload={from:env.REPORT_EMAIL_FROM,to:[to.email],subject:'Fasolo e Simon · '+report.title,text:`${actor.name} compartilhou o relatório ${report.title} da obra ${report.work.name}.\n\n${p.message||''}\n\nGerado em ${report.generatedAt}. Confira o PDF anexo.`};
  await env.BUCKET.put(pdfKey,pdf,{httpMetadata:{contentType:'application/pdf'}});
  try{
   actor=await loadActor(env.DB,actor);allow(actor,p.work,'reportsEmail');allow(actor,p.work,'reportsExport');
   await env.DB.prepare("INSERT OR IGNORE INTO report_emails(id,actor_id,actor_name,recipient_id,recipient_email,work_id,stage,request_key,fingerprint,pdf_key,payload,status,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,'ready',? FROM security_meta WHERE id=1 AND revision=?")
    .bind(id,actor.id,actor.name,to.id,to.email,p.work,p.stage,key,fingerprint,pdfKey,JSON.stringify(payload),new Date().toISOString(),actor.securityRevision).run();
   job=await env.DB.prepare('SELECT * FROM report_emails WHERE actor_id=? AND request_key=?').bind(actor.id,key).first();
   if(!job||job.id!==id)await env.BUCKET.delete(pdfKey);if(!job)securityError(409,'O acesso mudou durante a preparação. Atualize e tente novamente.');
   if(job.fingerprint!==fingerprint)securityError(409,'Identificador reutilizado para outro envio.');
  }catch(e){if(!await env.DB.prepare('SELECT id FROM report_emails WHERE id=?').bind(id).first())await env.BUCKET.delete(pdfKey);throw e;}
  return response(await dispatch(env.DB,env,actor,job,mailFetch));
 }
 const retry=path.match(/^\/api\/reports\/emails\/([a-f0-9-]+)\/retry$/);
 if(retry&&request.method==='POST'){const job=await env.DB.prepare('SELECT * FROM report_emails WHERE id=?').bind(retry[1]).first();if(!job)securityError(404,'Envio não encontrado.');return response(await dispatch(env.DB,env,actor,job,mailFetch));}
 return response({error:'Rota não encontrada.'},404);
}
