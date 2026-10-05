import { securityNotice } from './notifications.mjs';
import { roles, capabilities, can } from './permissions.mjs';
export function securityError(status, message, code) {
  throw Object.assign(new Error(message), { status, code });
}
function required(value, label, max = 300) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) securityError(400, 'Confira ' + label + '.');
  return value.trim();
}
export function authenticated(user) {
  if (!user?.id) securityError(401, 'Entre com sua identidade no ChatGPT.', 'LOGIN_REQUIRED');
  return { id: required(user.id, 'identidade'), name: typeof user.name === 'string' && user.name.trim() ? user.name.trim().slice(0,300) : user.id };
}
export async function registerIdentity(db, user) {
  const person = authenticated(user);
  await db.prepare('INSERT INTO security_users(id,name,last_seen) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,last_seen=excluded.last_seen')
    .bind(person.id, person.name, new Date().toISOString()).run();
  return person;
}
export async function loadActor(db, user) {
  const person = authenticated(user);
  // One batch provides a consistent permission/revision snapshot for conditional writes.
  const [account, access, grants, administrators, meta] = await db.batch([
    db.prepare('SELECT disabled FROM security_users WHERE id=?').bind(person.id),
    db.prepare('SELECT m.work_id,m.role,w.name FROM memberships m JOIN works w ON w.id=m.work_id WHERE m.user_id=? AND m.active=1').bind(person.id),
    db.prepare('SELECT role,permission FROM role_permissions'),
    db.prepare('SELECT user_id FROM security_admins WHERE user_id=?').bind(person.id),
    db.prepare('SELECT revision FROM security_meta WHERE id=1'),
  ]);
  if (!meta.results.length) securityError(503, 'Conclua a configuração de segurança do ambiente.', 'ERP_SETUP_REQUIRED');
  if (account.results[0]?.disabled) securityError(403, 'Seu acesso foi suspenso. Procure o administrador.', 'ACCOUNT_DISABLED');
  const actor = { ...person, isAdmin: administrators.results.length > 0, securityRevision: meta.results[0].revision,
    access: access.results.map(a => ({ ...a, permissions: grants.results.filter(g => g.role === a.role).map(g => g.permission) })) };
  if (!actor.isAdmin && !actor.access.length) securityError(403, 'Seu login foi reconhecido. Aguarde a liberação de cargo e obra pelo administrador.', 'ACCESS_PENDING');
  return actor;
}
export function allow(actor, work, action) {
  if (action ? !can(actor, action, work) : !actor.access.some(a => a.work_id === work))
    securityError(403, 'Você não tem esta permissão nesta obra.', 'PERMISSION_DENIED');
}
export function requireAdmin(actor) {
  if (!actor.isAdmin) securityError(403, 'Somente administradores podem gerenciar a segurança.', 'ADMIN_REQUIRED');
}
export async function securitySnapshot(db, actor) {
  requireAdmin(actor);
  const results = await db.batch([
    db.prepare('SELECT revision FROM security_meta WHERE id=1'),
    db.prepare("SELECT u.*,COALESCE(c.email,'') AS email,EXISTS(SELECT 1 FROM security_admins a WHERE a.user_id=u.id) AS admin FROM security_users u LEFT JOIN user_contacts c ON c.user_id=u.id ORDER BY u.name,u.id"),
    db.prepare('SELECT user_id,work_id,role FROM memberships WHERE active=1 ORDER BY user_id,work_id,role'),
    db.prepare('SELECT * FROM role_permissions ORDER BY role,permission'),
    db.prepare('SELECT id,name FROM works ORDER BY name'),
    db.prepare('SELECT * FROM security_audit ORDER BY at DESC,id DESC LIMIT 100'),
  ]);
  return { revision: results[0].results[0].revision, users: results[1].results, memberships: results[2].results,
    grants: results[3].results, works: results[4].results, audit: results[5].results, roles, capabilities };
}
export async function changeSecurity(db, actor, input, key) {
  requireAdmin(actor);
  if (!input || typeof input !== 'object') securityError(400, 'Comando inválido.');
  required(key, 'identificador da ação', 100);
  const fingerprint = JSON.stringify(input);
  const prior = await db.prepare('SELECT fingerprint FROM security_operations WHERE actor_id=? AND key=?').bind(actor.id,key).first();
  if (prior) {
    if (prior.fingerprint !== fingerprint) securityError(409, 'Identificador reutilizado para outra ação.');
    return { ok: true };
  }
  const reason = required(input.reason, 'motivo da alteração', 2000);
  const snapshot = await securitySnapshot(db, actor);
  if (!Number.isInteger(input.revision) || input.revision !== snapshot.revision || actor.securityRevision !== snapshot.revision)
    securityError(409, 'A segurança foi alterada por outra pessoa. Atualize e confira antes de salvar.', 'SECURITY_CHANGED');
  const operation = crypto.randomUUID(), guard = 'EXISTS(SELECT 1 FROM security_meta WHERE id=1 AND last_operation=?)';
  const statements = [db.prepare('UPDATE security_meta SET revision=revision+1,last_operation=? WHERE id=1 AND revision=?').bind(operation,input.revision)];
  let target, before, after;
  if (input.action === 'user') {
    target = required(input.userId, 'usuário');
    const current = snapshot.users.find(u => u.id === target);
    if (!current) securityError(400, 'Esta pessoa precisa entrar no aplicativo uma vez antes da liberação.');
    if (typeof input.disabled !== 'boolean' || typeof input.admin !== 'boolean' || !Array.isArray(input.memberships) || input.memberships.length > 200)
      securityError(400, 'Configuração de acesso inválida.');
    const email = input.email===undefined ? (current.email||'') : typeof input.email==='string' ? input.email.trim().toLowerCase() : null;
    if(email===null || email.length>254 || (email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))) securityError(400,'Confira o e-mail do colaborador.');
    const links = input.memberships.map(m => {
      if (!m || !Object.hasOwn(roles,m.role) || !snapshot.works.some(w => w.id === m.workId)) securityError(400, 'Cargo ou obra inválidos.');
      return { workId: m.workId, role: m.role };
    });
    if (new Set(links.map(m => JSON.stringify(m))).size !== links.length) securityError(400, 'Vínculo repetido.');
    if (current.admin && (input.disabled || !input.admin) && !snapshot.users.some(u => u.id !== target && u.admin && !u.disabled))
      securityError(409, 'Mantenha pelo menos um administrador ativo. Libere outro administrador antes de remover este acesso.');
    before = { email: current.email||'', admin: !!current.admin, disabled: !!current.disabled, memberships: snapshot.memberships.filter(m => m.user_id === target).map(m => ({workId:m.work_id,role:m.role})) };
    after = { email, admin: input.admin, disabled: input.disabled, memberships: links };
    statements.push(db.prepare(`UPDATE security_users SET disabled=? WHERE id=? AND ${guard}`).bind(Number(input.disabled),target,operation));
    statements.push(db.prepare(`INSERT INTO user_contacts(user_id,email) SELECT ?,? WHERE ${guard} ON CONFLICT(user_id) DO UPDATE SET email=excluded.email`).bind(target,email,operation));
    statements.push(db.prepare(`DELETE FROM memberships WHERE user_id=? AND ${guard}`).bind(target,operation));
    for (const m of links) statements.push(db.prepare(`INSERT INTO memberships(user_id,work_id,role,active) SELECT ?,?,?,1 WHERE ${guard}`).bind(target,m.workId,m.role,operation));
    statements.push(db.prepare(`DELETE FROM security_admins WHERE user_id=? AND ${guard}`).bind(target,operation));
    if (input.admin) statements.push(db.prepare(`INSERT INTO security_admins(user_id) SELECT ? WHERE ${guard}`).bind(target,operation));
  } else if (input.action === 'role') {
    target = input.role;
    if (!Object.hasOwn(roles,target) || !Array.isArray(input.permissions) || input.permissions.some(p => !Object.hasOwn(capabilities,p)) || new Set(input.permissions).size !== input.permissions.length)
      securityError(400, 'Poderes do cargo inválidos.');
    before = snapshot.grants.filter(g => g.role === target).map(g => g.permission);
    after = [...input.permissions].sort();
    statements.push(db.prepare(`DELETE FROM role_permissions WHERE role=? AND ${guard}`).bind(target,operation));
    for (const permission of after) statements.push(db.prepare(`INSERT INTO role_permissions(role,permission) SELECT ?,? WHERE ${guard}`).bind(target,permission,operation));
  } else if (input.action === 'work') {
    target = required(input.workId, 'código da obra', 60);
    const name = required(input.name, 'nome da obra');
    if (!/^[A-Za-z0-9_-]+$/.test(target) || snapshot.works.some(w => w.id === target)) securityError(400, 'Código de obra inválido ou já cadastrado.');
    before = null; after = { id: target, name };
    const budgetPath = '$.budgetServices."'+target+'"';
    const budget = JSON.stringify([{id:'nao-previsto',name:'Despesa não prevista',budget:null}]);
    const nextSize = "length(CAST(json_set(json_insert(data,'$.budgetServices',json('{}')),?,json(?)) AS BLOB))";
    const size = await db.prepare(`SELECT ${nextSize} AS size FROM erp_state WHERE id=1`).bind(budgetPath,budget).first();
    if (size.size > 1024*1024) securityError(413, 'Capacidade desta versão atingida. Amplie o modelo antes de cadastrar novas obras.');
    statements[0] = db.prepare(`UPDATE security_meta SET revision=revision+1,last_operation=? WHERE id=1 AND revision=? AND EXISTS(SELECT 1 FROM erp_state WHERE id=1 AND ${nextSize}<=1048576)`).bind(operation,input.revision,budgetPath,budget);
    statements.push(db.prepare(`INSERT INTO works(id,name) SELECT ?,? WHERE ${guard}`).bind(target,name,operation));
    // Use SQLite JSON functions on the latest state so operational data is not replaced.
    statements.push(db.prepare(`UPDATE erp_state SET data=json_set(json_insert(data,'$.budgetServices',json('{}')),?,json(?)),revision=revision+1 WHERE id=1 AND ${guard}`)
      .bind(budgetPath,budget,operation));
  } else securityError(400, 'Ação de segurança inválida.');
  statements.push(db.prepare(`INSERT INTO security_audit(id,actor_id,actor_name,action,target,reason,before_json,after_json,at) SELECT ?,?,?,?,?,?,?,?,? WHERE ${guard}`)
    .bind(operation,actor.id,actor.name,input.action,target,reason,JSON.stringify(before),JSON.stringify(after),new Date().toISOString(),operation));
  statements.push(db.prepare(`INSERT INTO security_operations(actor_id,key,fingerprint) SELECT ?,?,? WHERE ${guard}`).bind(actor.id,key,fingerprint,operation));
  statements.push(...securityNotice(db,actor,target,input.action,operation));
  const result = await db.batch(statements);
  if (result[0].meta.changes !== 1) securityError(409, 'A segurança foi alterada. Atualize e confira antes de salvar.', 'SECURITY_CHANGED');
  return { ok: true };
}
