// Generate SQL for an explicitly chosen first administrator. Never connects to a server.
const id = process.argv[2];
if (!id?.trim() || id.length > 300) throw Error('Uso: node scripts/bootstrap-admin.mjs IDENTIFICADOR_DA_SESSAO > /tmp/fes-admin.sql');
const quote = value => "'"+value.replaceAll("'","''")+"'";
console.log(`-- Revisar e executar somente no D1 de homologação, com as migrações aplicadas.
-- O usuário deve ter entrado uma vez. Sem usuário reconhecido ou se já existir admin, nenhuma concessão é feita.
INSERT INTO security_admins(user_id)
SELECT id FROM security_users WHERE id=${quote(id.trim())} AND disabled=0
AND NOT EXISTS(SELECT 1 FROM security_admins);
INSERT INTO security_audit(id,actor_id,actor_name,action,target,reason,before_json,after_json,at)
SELECT ${quote(crypto.randomUUID())},'setup:operator','Configuração inicial via D1','user',${quote(id.trim())},
'Primeiro administrador configurado pelo operador do ambiente','null','{"admin":true}',strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE changes()=1;
UPDATE security_meta SET revision=revision+1 WHERE id=1 AND changes()=1;
-- Conferir o resultado abaixo. Configurações posteriores são feitas pela aba Segurança.
SELECT u.id,u.name FROM security_users u JOIN security_admins a ON a.user_id=u.id;`);
