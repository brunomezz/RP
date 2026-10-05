import { allow, loadActor, securityError } from './security.mjs';
import { extractPDF, importSuggestions } from './pdf-import.mjs';
const LIMIT=10*1024*1024;
export function documentTarget(state,work,kind,id){
 if(!kind&&!id)return;
 const record=({request:state.requests,order:state.orders,contract:state.contracts}[kind]||[]).find(r=>r.id===id);
 if(!record||record.work!==work)securityError(400,'Registro não pertence à obra selecionada.');
}
export async function documentRoutes(request,env,actor,{json,readLimited,response}){
 const url=new URL(request.url),path=url.pathname;if(!path.startsWith('/api/documents'))return null;
 if(path==='/api/documents'&&request.method==='GET'){
  const work=url.searchParams.get('work');allow(actor,work);
  const rows=await env.DB.prepare('SELECT id,work_id,owner_name,name,size,pages,extraction_status,linked_kind,linked_record_id,created_at FROM documents WHERE work_id=? ORDER BY created_at DESC LIMIT 200').bind(work).all();return response(rows.results);
 }
 if(path==='/api/documents'&&request.method==='POST'){
  const work=url.searchParams.get('work'),name=url.searchParams.get('name'),kind=url.searchParams.get('kind')||null,recordId=url.searchParams.get('recordId')||null;
  allow(actor,work,'documentsImport');if(!name||name.length>255||!name.toLowerCase().endsWith('.pdf'))securityError(400,'Informe um nome de arquivo PDF.');
  const state=JSON.parse((await env.DB.prepare('SELECT data FROM erp_state WHERE id=1').first()).data);documentTarget(state,work,kind,recordId);
  const bytes=await readLimited(request,LIMIT);if(!bytes.length)securityError(400,'O PDF está vazio.');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const previous=await env.DB.prepare('SELECT id FROM documents WHERE work_id=? AND sha256=?').bind(work,hash).first();if(previous)return response({id:previous.id,duplicate:true});
  const extracted=await extractPDF(bytes);actor=await loadActor(env.DB,actor);allow(actor,work,'documentsImport');
  const id=crypto.randomUUID(),at=new Date().toISOString(),safeName=name.replace(/[\r\n\\/\x00-\x1f]/g,'_');await env.BUCKET.put('documents/'+id,bytes,{httpMetadata:{contentType:'application/pdf'}});
  try{
   const result=await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO documents(id,work_id,owner_id,owner_name,name,size,sha256,pages,extracted_text,extraction_status,linked_kind,linked_record_id,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? FROM security_meta WHERE id=1 AND revision=?')
     .bind(id,work,actor.id,actor.name,safeName,bytes.length,hash,extracted.pages,extracted.text,extracted.status,kind,recordId,at,actor.securityRevision),
    env.DB.prepare("INSERT INTO communication_audit(id,actor_id,actor_name,work_id,action,target,created_at,detail) SELECT ?,?,?,?,'document-import',?,?,? WHERE EXISTS(SELECT 1 FROM documents WHERE id=?)").bind(crypto.randomUUID(),actor.id,actor.name,work,id,at,'PDF importado; dados operacionais aguardam revisão.',id),
   ]);
   if(!result[0].meta.changes){await env.BUCKET.delete('documents/'+id);const duplicate=await env.DB.prepare('SELECT id FROM documents WHERE work_id=? AND sha256=?').bind(work,hash).first();if(duplicate)return response({id:duplicate.id,duplicate:true});securityError(409,'O acesso mudou durante a importação. Atualize e tente novamente.');}
   return response({id,duplicate:false},201);
  }catch(e){if(!await env.DB.prepare('SELECT id FROM documents WHERE id=?').bind(id).first())await env.BUCKET.delete('documents/'+id);throw e;}
 }
 const match=path.match(/^\/api\/documents\/([a-f0-9-]+)(\/file|\/link)?$/);if(!match)return response({error:'Rota não encontrada.'},404);
 const doc=await env.DB.prepare('SELECT * FROM documents WHERE id=?').bind(match[1]).first();if(!doc)securityError(404,'Documento não encontrado.');allow(actor,doc.work_id);
 if(request.method==='GET'&&match[2]==='/file'){
  const object=await env.BUCKET.get('documents/'+doc.id);if(!object)securityError(404,'PDF indisponível.');
  return new Response(object.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
 }
 const state=JSON.parse((await env.DB.prepare('SELECT data FROM erp_state WHERE id=1').first()).data);
 if(request.method==='GET'&&!match[2]){const imported=await env.DB.prepare('SELECT * FROM document_imports WHERE document_id=?').bind(doc.id).first();return response({...doc,imported,suggestions:importSuggestions(doc.extracted_text,state)});}
 if(request.method==='POST'&&match[2]==='/link'){
  allow(actor,doc.work_id,'documentsImport');const p=await json(request);documentTarget(state,doc.work_id,p.kind,p.recordId);if(!p.kind)securityError(400,'Selecione um registro.');
  const at=new Date().toISOString(),op=crypto.randomUUID();
  const result=await env.DB.batch([
   env.DB.prepare('UPDATE documents SET linked_kind=?,linked_record_id=? WHERE id=? AND linked_record_id IS NULL AND NOT EXISTS(SELECT 1 FROM document_imports WHERE document_id=?) AND EXISTS(SELECT 1 FROM security_meta WHERE id=1 AND revision=?)').bind(p.kind,p.recordId,doc.id,doc.id,actor.securityRevision),
   env.DB.prepare("INSERT INTO communication_audit(id,actor_id,actor_name,work_id,action,target,created_at,detail) SELECT ?,?,?,?,'document-link',?,?,? WHERE changes()=1").bind(op,actor.id,actor.name,doc.work_id,doc.id,at,p.kind+': '+p.recordId),
  ]);if(!result[0].meta.changes)securityError(409,'Documento já vinculado ou acesso alterado. Atualize para conferir.');return response({ok:true});
 }
 return response({error:'Rota não encontrada.'},404);
}
