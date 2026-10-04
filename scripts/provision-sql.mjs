// Generates reviewed administrative SQL. Does not connect or publish anything.
import { readFile } from "node:fs/promises";
const file = process.argv[2];
if (!file)
  throw Error(
    "Uso: node scripts/provision-sql.mjs work-config.local.json > /tmp/fes-config.sql",
  );
const config = JSON.parse(await readFile(file, "utf8"));
const quote = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const roles = new Set(["almoxarifado", "engenharia", "suprimentos", "diretor"]);
if (!Array.isArray(config.works) || !config.works.length)
  throw Error("Configure pelo menos uma obra.");
const seen = new Set(),
  sql = [];
for (const w of config.works) {
  if (
    !/^[A-Za-z0-9_-]{1,60}$/.test(w.id) ||
    seen.has(w.id) ||
    typeof w.name !== "string" ||
    !w.name.trim()
  )
    throw Error("Identificação de obra inválida ou repetida.");
  seen.add(w.id);
  if (
    !Array.isArray(w.services) ||
    !w.services.length ||
    w.services.some(
      (s) =>
        typeof s.id !== "string" ||
        !s.id ||
        typeof s.name !== "string" ||
        !s.name.trim() ||
        (s.budget !== null &&
          (typeof s.budget !== "number" ||
            !Number.isFinite(s.budget) ||
            s.budget < 0)),
    ) ||
    new Set(w.services.map((s) => s.id)).size !== w.services.length
  )
    throw Error("Serviços do orçamento inválidos.");
  sql.push(
    `INSERT INTO works(id,name) VALUES(${quote(w.id)},${quote(w.name)}) ON CONFLICT(id) DO UPDATE SET name=excluded.name;`,
  );
  const path = '$.budgetServices."' + w.id + '"';
  sql.push(
    `UPDATE erp_state SET data=json_insert(data,'$.budgetServices',json('{}')) WHERE id=1;`,
  );
  sql.push(
    `UPDATE erp_state SET data=json_set(data,${quote(path)},json(${quote(JSON.stringify(w.services))})), revision=revision+1 WHERE id=1 AND json_type(data,${quote(path)}) IS NULL;`,
  );
}
if (!Array.isArray(config.memberships))
  throw Error("Configure as funções internas.");
for (const m of config.memberships) {
  if (
    typeof m.userId !== "string" ||
    !m.userId.trim() ||
    m.userId.length > 300 ||
    !seen.has(m.workId) ||
    !roles.has(m.role)
  )
    throw Error("Permissão inválida.");
  sql.push(
    `INSERT INTO memberships(user_id,work_id,role,active) VALUES(${quote(m.userId)},${quote(m.workId)},${quote(m.role)},1) ON CONFLICT(user_id,work_id,role) DO UPDATE SET active=1;`,
  );
}
console.log(
  "-- Executar somente no D1 do site de homologação, com a aplicação sem escritas.\n" +
    sql.join("\n"),
);
