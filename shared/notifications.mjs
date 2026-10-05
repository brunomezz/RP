export function operationNotice(db,actor,changed,operation,action,title){
 const pages={create:'aprovacoes',edit:'aprovacoes',engineering:'cotacoes',quote:'cotacoes',send:'aprovacoes',reject:'solicitacoes',director:'pedidos',arrival:'recebimentos',receive:'estoque',measure:'medicoes',withdraw:'movimentos'};
 if(!pages[action])return [];
 return [db.prepare(`INSERT OR IGNORE INTO notifications(id,user_id,work_id,record_id,page,title,message,created_at,event_key)
 SELECT DISTINCT ?||':'||u.id,u.id,?,?,?, ?,?,?,? FROM security_users u
 WHERE (EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.work_id=? AND m.active=1) OR EXISTS(SELECT 1 FROM security_admins a WHERE a.user_id=u.id)) AND u.disabled=0 AND u.id<>? AND EXISTS(SELECT 1 FROM erp_state WHERE id=1 AND last_operation=?)`)
 .bind(operation,changed.work,changed.recordId,pages[action],title,actor.name+' · '+changed.recordId,changed.at,operation,changed.work,actor.id,operation)];
}
export function securityNotice(db,actor,target,kind,operation){
 if(!['user','role'].includes(kind))return [];
 return [db.prepare(`INSERT OR IGNORE INTO notifications(id,user_id,page,title,message,created_at,event_key)
 SELECT ?||':'||u.id,u.id,'notificacoes','Seu acesso foi atualizado',?, ?,? FROM security_users u
 WHERE ${kind==='user'?'u.id=?':'EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id AND m.role=? AND m.active=1)'} AND u.id<>? AND EXISTS(SELECT 1 FROM security_meta WHERE id=1 AND last_operation=?)`)
 .bind(operation,'O administrador '+actor.name+' atualizou cargos ou poderes. Atualize o aplicativo para conferir.',new Date().toISOString(),operation,target,actor.id,operation)];
}
export async function notificationRoutes(request,env,actor,{json,response}){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/notifications'))return null;
 const visible="(work_id IS NULL OR "+(actor.isAdmin?"1":"0")+"=1 OR EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=? AND m.work_id=notifications.work_id AND m.active=1))";
 if(url.pathname==='/api/notifications'&&request.method==='GET'){
  const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)return response({error:'Página inválida.'},400);
  const data=await env.DB.batch([
   env.DB.prepare(`SELECT * FROM notifications WHERE user_id=? AND ${visible} ORDER BY created_at DESC,id DESC LIMIT 50 OFFSET ?`).bind(actor.id,actor.id,offset),
   env.DB.prepare(`SELECT COUNT(*) AS unread FROM notifications WHERE user_id=? AND read_at IS NULL AND ${visible}`).bind(actor.id,actor.id),
  ]);return response({items:data[0].results,unread:data[1].results[0].unread,offset,nextOffset:data[0].results.length===50?offset+50:null});
 }
 if(url.pathname==='/api/notifications/read'&&request.method==='POST'){
  const body=await json(request);if(body.all!==true&&typeof body.id!=='string')return response({error:'Selecione uma notificação.'},400);
  const query=`UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE user_id=? AND ${visible}`+(body.all===true?'':' AND id=?');
  await env.DB.prepare(query).bind(new Date().toISOString(),actor.id,actor.id,...(body.all===true?[]:[body.id])).run();return response({ok:true});
 }
 return response({error:'Rota não encontrada.'},404);
}
