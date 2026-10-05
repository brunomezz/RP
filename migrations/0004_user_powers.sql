-- Existing explicitly appointed administrators now represent the full Admin role.
-- Never appoints a visitor or changes ordinary memberships/grants.
CREATE TABLE IF NOT EXISTS user_permissions (
 user_id TEXT NOT NULL REFERENCES security_users(id),
 work_id TEXT NOT NULL REFERENCES works(id),
 permission TEXT NOT NULL,
 effect TEXT NOT NULL CHECK(effect IN ('allow','deny')),
 PRIMARY KEY(user_id,work_id,permission)
);
INSERT OR IGNORE INTO security_migrations(id) VALUES('user-powers');
