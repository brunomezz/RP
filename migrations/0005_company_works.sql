-- One company registry: existing active roles become company-wide functions.
-- No visitor is assigned a role and no operational record is copied or reset.
CREATE TABLE IF NOT EXISTS user_roles (
 user_id TEXT NOT NULL REFERENCES security_users(id),
 role TEXT NOT NULL CHECK(role IN ('almoxarifado','engenharia','suprimentos','diretor')),
 PRIMARY KEY(user_id,role)
);
INSERT OR IGNORE INTO user_roles(user_id,role)
 SELECT DISTINCT user_id,role FROM memberships WHERE active=1
 AND NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='company-works');
INSERT INTO memberships(user_id,work_id,role,active)
 SELECT r.user_id,w.id,r.role,1 FROM user_roles r CROSS JOIN works w
 WHERE NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='company-works')
 ON CONFLICT(user_id,work_id,role) DO UPDATE SET active=1;
UPDATE security_meta SET revision=revision+1 WHERE id=1 AND NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='company-works');
INSERT OR IGNORE INTO security_migrations(id) VALUES('company-works');
