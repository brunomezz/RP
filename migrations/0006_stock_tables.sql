-- 0.10: registers and stock leave the erp_state aggregate (1 MiB limit).
-- Rows keep their JSON. Existing records are moved once, in their original order.
CREATE TABLE IF NOT EXISTS catalog_items (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS supplier_rows (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stock_movements (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stock_reservations (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stock_locations (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stock_closings (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
INSERT OR IGNORE INTO catalog_items(id,data)
 SELECT COALESCE(json_extract(j.value,'$.id'),'MAT-'||j.key), json_set(j.value,'$.id',COALESCE(json_extract(j.value,'$.id'),'MAT-'||j.key))
 FROM erp_state s, json_each(s.data,'$.catalog') j WHERE s.id=1 AND NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='stock-tables') ORDER BY j.key;
INSERT OR IGNORE INTO supplier_rows(id,data)
 SELECT COALESCE(json_extract(j.value,'$.id'),'SUP-'||j.key), json_set(j.value,'$.id',COALESCE(json_extract(j.value,'$.id'),'SUP-'||j.key))
 FROM erp_state s, json_each(s.data,'$.suppliers') j WHERE s.id=1 AND NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='stock-tables') ORDER BY j.key;
INSERT OR IGNORE INTO stock_movements(id,data)
 SELECT COALESCE(json_extract(j.value,'$.id'),'MOV-'||j.key), json_set(j.value,'$.id',COALESCE(json_extract(j.value,'$.id'),'MOV-'||j.key))
 FROM erp_state s, json_each(s.data,'$.movements') j WHERE s.id=1 AND NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='stock-tables') ORDER BY j.key;
UPDATE erp_state SET data=json_remove(data,'$.catalog','$.suppliers','$.movements'),revision=revision+1 WHERE id=1 AND NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='stock-tables');
-- New stock powers start with the roles that already run the warehouse. Admin keeps all.
INSERT OR IGNORE INTO role_permissions(role,permission) SELECT 'almoxarifado',value FROM json_each('["reserve","transfer","stockReturn","stockInit","location"]') WHERE NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='stock-tables');
INSERT OR IGNORE INTO role_permissions(role,permission) SELECT 'engenharia',value FROM json_each('["reserve"]') WHERE NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='stock-tables');
INSERT OR IGNORE INTO role_permissions(role,permission) SELECT 'diretor',value FROM json_each('["stockClose"]') WHERE NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='stock-tables');
UPDATE security_meta SET revision=revision+1 WHERE id=1 AND NOT EXISTS(SELECT 1 FROM security_migrations WHERE id='stock-tables');
INSERT OR IGNORE INTO security_migrations(id) VALUES('stock-tables');
