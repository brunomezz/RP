import { Miniflare } from "miniflare";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
export const personas = {
  user1: {
    id: "test-almox",
    name: "Teste · Almoxarifado",
    role: "almoxarifado",
    work: "ELYSIUM",
  },
  user2: {
    id: "test-engineer",
    name: "Teste · Engenharia",
    role: "engenharia",
    work: "ELYSIUM",
  },
  procurement: {
    id: "test-procurement",
    name: "Teste · Suprimentos",
    role: "suprimentos",
    work: "ELYSIUM",
  },
  director: {
    id: "test-director",
    name: "Teste · Diretor",
    role: "diretor",
    work: "ELYSIUM",
  },
  restricted: {
    id: "test-restricted",
    name: "Teste · Outra obra",
    role: "almoxarifado",
    work: "BLEND",
  },
  unassigned: { id: "test-unassigned", name: "Teste · Sem função" },
};
export async function createHarness(persistPath) {
  const sessions = new Map();
  const compiled = await build({
    entryPoints: [
      fileURLToPath(new URL("tests/integration/fixture-worker.mjs", root)),
    ],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
  });
  const auth = async (request) => {
    const path = new URL(request.url).pathname;
    if (path === "/dev/login" && request.method === "POST") {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin)
        return new Response("Origem inválida", { status: 403 });
      const form = await request.formData(),
        person = personas[form.get("persona")];
      if (!person) return new Response("Persona inválida", { status: 400 });
      const token = crypto.randomUUID();
      sessions.set(token, person);
      return Response.json(
        { id: person.id },
        {
          headers: {
            "Set-Cookie": `fes_dev_session=${token}; HttpOnly; SameSite=Strict; Path=/`,
          },
        },
      );
    }
    const token = request.headers
      .get("cookie")
      ?.match(/fes_dev_session=([^;]+)/)?.[1];
    if (path === "/dev/logout") {
      sessions.delete(token);
      return Response.json(
        { ok: true },
        {
          headers: {
            "Set-Cookie":
              "fes_dev_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/",
          },
        },
      );
    }
    const person = sessions.get(token);
    return person
      ? Response.json({ id: person.id, name: person.name })
      : new Response("Sem sessão", { status: 401 });
  };
  const mf = new Miniflare({
    modules: true,
    script: compiled.outputFiles[0].text,
    compatibilityDate: "2026-07-01",
    d1Databases: { DB: "fes-development" },
    r2Buckets: ["BUCKET"],
    d1Persist: persistPath ? persistPath + "/d1" : false,
    r2Persist: persistPath ? persistPath + "/r2" : false,
    serviceBindings: { TEST_AUTH: auth },
  });
  const db = await mf.getD1Database("DB");
  const schema = await readFile(
    new URL("migrations/0001_shared.sql", root),
    "utf8",
  );
  for (const sql of schema.split(";").filter((s) => s.trim()))
    await db.prepare(sql).run();
  await db
    .prepare(
      "INSERT OR IGNORE INTO works(id,name) VALUES('ELYSIUM','ELYSIUM · teste'),('BLEND','BLEND · teste')",
    )
    .run();
  for (const p of Object.values(personas))
    if (p.role)
      await db
        .prepare(
          "INSERT OR IGNORE INTO memberships(user_id,work_id,role) VALUES(?,?,?)",
        )
        .bind(p.id, p.work, p.role)
        .run();
  const row = await db.prepare("SELECT data FROM erp_state WHERE id=1").first(),
    state = JSON.parse(row.data);
  if (!state.budgetServices) {
    state.catalog = [
      { id: "bloco", name: "Bloco · catálogo de teste", unit: "un" },
    ];
    state.budgetServices = {
      ELYSIUM: [
        { id: "alvenaria", name: "Alvenaria · teste", budget: 10000 },
        { id: "nao-previsto", name: "Despesa não prevista", budget: null },
      ],
      BLEND: [{ id: "estrutura", name: "Estrutura · teste", budget: 20000 }],
    };
    await db
      .prepare("UPDATE erp_state SET data=? WHERE id=1")
      .bind(JSON.stringify(state))
      .run();
  }
  return {
    mf,
    db,
    async login(persona) {
      const r = await mf.dispatchFetch("http://erp.test/dev/login", {
        method: "POST",
        body: new URLSearchParams({ persona }),
      });
      return r.headers.get("set-cookie").split(";")[0];
    },
    async fetch(path, cookie, options = {}) {
      return mf.dispatchFetch("http://erp.test" + path, {
        ...options,
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
      });
    },
    close: () => mf.dispose(),
  };
}
