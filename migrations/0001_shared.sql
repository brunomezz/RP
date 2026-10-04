PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS erp_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0, last_operation TEXT, data TEXT NOT NULL);
INSERT OR IGNORE INTO erp_state(id,data) VALUES(1,'{"version":2,"requests":[],"orders":[],"contracts":[],"movements":[],"catalog":[],"suppliers":[]}');
CREATE TABLE IF NOT EXISTS works (id TEXT PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (user_id TEXT NOT NULL, work_id TEXT NOT NULL REFERENCES works(id), role TEXT NOT NULL CHECK(role IN ('almoxarifado','engenharia','suprimentos','diretor')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN(0,1)), PRIMARY KEY(user_id,work_id,role));
CREATE TABLE IF NOT EXISTS operations (actor_id TEXT NOT NULL, key TEXT NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(actor_id,key));
CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, work_id TEXT, record_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL, reason TEXT, operation_id TEXT NOT NULL UNIQUE);
CREATE INDEX IF NOT EXISTS audit_work ON audit(work_id,at);
CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, work_id TEXT NOT NULL REFERENCES works(id), target_kind TEXT NOT NULL CHECK(target_kind IN ('request','order')), target_id TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL CHECK(size>0 AND size<=10485760), uploaded INTEGER NOT NULL DEFAULT 0, finalized INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
