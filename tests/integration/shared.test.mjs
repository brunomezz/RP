import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHarness } from "./harness.mjs";
const item = {
  kind: "material",
  material: "bloco",
  qty: 10,
  service: "alvenaria",
  neededDate: "2026-11-10",
  location: "Torre A · 1º andar",
};
async function snapshot(h, c) {
  const r = await h.fetch("/api/state", c);
  assert.equal(r.status, 200);
  return r.json();
}
async function command(h, c, body, key = crypto.randomUUID()) {
  return h.fetch("/api/commands", c, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
}
async function ok(h, c, body, key) {
  const r = await command(h, c, body, key);
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
async function current(h, c, id) {
  return (await snapshot(h, c)).requests.find((r) => r.id === id);
}
async function request(h, c, items = [item]) {
  return (
    await ok(h, c, {
      action: "create",
      work: "ELYSIUM",
      purpose: "Necessidade de teste",
      items,
    })
  ).id;
}
async function approved(h, cookies, items = [item]) {
  const id = await request(h, cookies.a, items);
  let r = await current(h, cookies.e, id);
  await ok(h, cookies.e, {
    action: "engineering",
    id,
    expectedRevision: r.revision,
    services: items.map(() => "alvenaria"),
  });
  r = await current(h, cookies.p, id);
  await ok(h, cookies.p, {
    action: "quote",
    id,
    expectedRevision: r.revision,
    supplier: "Fornecedor " + id,
    prices: items.map(() => 12),
    freight: 10,
    days: 3,
    payment: "28 dias",
    scope: "Integral",
  });
  r = await current(h, cookies.p, id);
  await ok(h, cookies.p, {
    action: "suggest",
    id,
    expectedRevision: r.revision,
    allocations: items.map(() => r.quotes[0].id),
  });
  r = await current(h, cookies.p, id);
  await ok(h, cookies.p, {
    action: "send",
    id,
    expectedRevision: r.revision,
    exception: "Fornecedor exclusivo no teste",
  });
  return current(h, cookies.d, id);
}
async function setup() {
  const h = await createHarness();
  const cookies = {
    a: await h.login("user1"),
    e: await h.login("user2"),
    p: await h.login("procurement"),
    d: await h.login("director"),
    x: await h.login("restricted"),
  };
  return { h, cookies };
}

test("duas sessões compartilham solicitação; identidade e orçamento não vêm do cliente", async () => {
  const { h, cookies: c } = await setup();
  try {
    const id = await request(h, c.a);
    const r = await current(h, c.e, id);
    assert.equal(r.items[0].neededDate, item.neededDate);
    assert.equal(r.requester, "Teste · Almoxarifado");
    assert.equal(r.history[0].actorId, "test-almox");
    assert.ok(r.history[0].at.includes("T"));
    assert.equal((await snapshot(h, c.x)).requests.length, 1);
    assert.ok((await snapshot(h, c.x)).budgetServices.ELYSIUM.length);
    const spoof = await command(h, c.a, {
      action: "engineering",
      id,
      expectedRevision: r.revision,
      services: ["alvenaria"],
      actorId: "test-engineer",
    });
    assert.equal(spoof.status, 403);
    assert.equal((await current(h, c.e, id)).status, "engineering");
  } finally {
    await h.close();
  }
});

test("persistência D1/R2 após logout, outra sessão e reinício completo do runtime", async () => {
  const dir = await mkdtemp(join(tmpdir(), "fes-persist-"));
  let h = await createHarness(dir);
  try {
    let a = await h.login("user1"),
      e = await h.login("user2"),
      p = await h.login("procurement");
    const id = await request(h, a);
    let r = await current(h, e, id);
    await ok(h, e, {
      action: "engineering",
      id,
      expectedRevision: r.revision,
      services: ["alvenaria"],
    });
    const reserve = await h.fetch("/api/files", p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetKind: "request",
        targetId: id,
        name: "persistente.txt",
        size: 3,
      }),
    });
    const file = await reserve.json();
    assert.equal(
      (
        await h.fetch("/api/files/" + file.id, p, {
          method: "PUT",
          body: "abc",
        })
      ).status,
      200,
    );
    r = await current(h, p, id);
    await ok(h, p, {
      action: "quote",
      id,
      expectedRevision: r.revision,
      supplier: "Persistente",
      prices: [10],
      freight: 0,
      days: 1,
      payment: "À vista",
      scope: "Integral",
      files: [file.id],
    });
    await h.fetch("/dev/logout", a, { method: "POST" });
    assert.equal((await h.fetch("/api/state", a)).status, 401);
    a = await h.login("user1");
    assert.equal((await current(h, a, id)).id, id);
    await h.close();
    h = await createHarness(dir);
    e = await h.login("user2");
    assert.equal(
      (await current(h, e, id)).quotes[0].attachments[0].id,
      file.id,
    );
    assert.equal(
      await (await h.fetch("/api/files/" + file.id, e)).text(),
      "abc",
    );
  } finally {
    await h.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("API bloqueia acesso sem sessão, sem função, função errada, obra inexistente e origem externa", async () => {
  const { h, cookies: c } = await setup();
  try {
    assert.equal((await h.fetch("/api/state")).status, 401);
    const no = await h.login("unassigned");
    assert.equal((await h.fetch("/api/state", no)).status, 403);
    assert.equal(
      (
        await command(h, c.x, {
          action: "create",
          work: "OBRA_INEXISTENTE",
          purpose: "Obra inexistente",
          items: [item],
        })
      ).status,
      403,
    );
    const r = await approved(h, c);
    const action = {
      action: "director",
      id: r.id,
      expectedRevision: r.revision,
      decisions: [r.quotes[0].id],
      arrivals: ["2026-11-09"],
    };
    assert.equal((await command(h, c.a, action)).status, 403);
    assert.equal((await command(h, c.p, action)).status, 403);
    assert.equal((await command(h, c.x, action)).status, 403);
    assert.equal((await snapshot(h, c.d)).orders.length, 0);
    assert.equal(
      (
        await h.fetch("/api/commands", c.a, {
          method: "POST",
          headers: {
            Origin: "https://evil.test",
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            action: "create",
            work: "ELYSIUM",
            items: [item],
            purpose: "CSRF",
          }),
        })
      ).status,
      403,
    );
  } finally {
    await h.close();
  }
});

test("aprovações simultâneas não duplicam pedidos; repetição tem resultado idempotente", async () => {
  const { h, cookies: c } = await setup();
  try {
    const r = await approved(h, c);
    const body = {
        action: "director",
        id: r.id,
        expectedRevision: r.revision,
        decisions: [r.quotes[0].id],
        arrivals: ["2026-11-09"],
      },
      key = crypto.randomUUID();
    const results = await Promise.all([
      command(h, c.d, body, key),
      command(h, c.d, body, key),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200],
    );
    assert.equal((await snapshot(h, c.a)).orders.length, 1);
    assert.equal((await command(h, c.d, body)).status, 409);
    assert.equal(
      (await command(h, c.d, { ...body, arrivals: ["2026-12-01"] }, key))
        .status,
      409,
    );
    const audit = await (await h.fetch("/api/audit", c.e)).json();
    assert.equal(audit.filter((a) => a.action === "director").length, 1);
    assert.equal(
      audit.find((a) => a.action === "director").actor_id,
      "test-director",
    );
  } finally {
    await h.close();
  }
});

test("recebimentos e saídas simultâneos não duplicam estoque nem permitem saldo negativo", async () => {
  const { h, cookies: c } = await setup();
  try {
    const r = await approved(h, c);
    await ok(h, c.d, {
      action: "director",
      id: r.id,
      expectedRevision: r.revision,
      decisions: [r.quotes[0].id],
      arrivals: ["2026-11-09"],
    });
    const o = (await snapshot(h, c.a)).orders[0],
      body = {
        action: "receive",
        id: o.id,
        expectedRevision: o.revision,
        quantities: [6],
        nf: "100",
        note: "Entrega parcial",
      },
      key = crypto.randomUUID();
    const results = await Promise.all([
      command(h, c.a, body, key),
      command(h, c.a, body, key),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [200, 200],
    );
    let s = await snapshot(h, c.a);
    assert.equal(s.movements.length, 1);
    assert.equal(s.orders[0].receipts.length, 1);
    assert.equal(s.orders[0].items[0].received, 6);
    const next = {
      ...body,
      expectedRevision: s.orders[0].revision,
      quantities: [4],
      nf: "101",
    };
    const concurrent = await Promise.all([
      command(h, c.a, next),
      command(h, c.a, next),
    ]);
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    s = await snapshot(h, c.a);
    assert.equal(
      s.movements.reduce((v, m) => v + m.qty, 0),
      10,
    );
    assert.equal(s.orders[0].receipts.length, 2);
    const out = {
      action: "withdraw",
      work: "ELYSIUM",
      expectedStateRevision: s.revision,
      material: "bloco",
      qty: 7,
      recipient: "Operário",
      service: "alvenaria",
      floor: "1º andar",
    };
    const withdrawals = await Promise.all([
      command(h, c.a, out),
      command(h, c.a, out),
    ]);
    assert.deepEqual(withdrawals.map((r) => r.status).sort(), [200, 409]);
    s = await snapshot(h, c.a);
    assert.equal(s.movements.filter((m) => m.kind === "out").length, 1);
    assert.equal(s.movements.at(-1).actorId, "test-almox");
    assert.equal(s.movements.at(-1).who, "Operário");
  } finally {
    await h.close();
  }
});

test("anexo R2 compartilhado, vinculado, imutável, limite de 10 MB e obra autorizada", async () => {
  const { h, cookies: c } = await setup();
  try {
    const id = await request(h, c.a);
    let r = await current(h, c.e, id);
    await ok(h, c.e, {
      action: "engineering",
      id,
      expectedRevision: r.revision,
      services: ["alvenaria"],
    });
    const reserve = (p) =>
      h.fetch("/api/files", c.p, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetKind: "request",
          targetId: id,
          name: "cotacao.txt",
          size: 4,
          ...p,
        }),
      });
    assert.equal((await reserve({ size: 10485761 })).status, 413);
    const f = await (await reserve({})).json();
    assert.equal(
      (await h.fetch("/api/files/" + f.id, c.p, { method: "PUT", body: "abc" }))
        .status,
      400,
    );
    assert.equal(
      (
        await h.fetch("/api/files/" + f.id, c.p, {
          method: "PUT",
          body: "abcd",
        })
      ).status,
      200,
    );
    assert.equal((await h.fetch("/api/files/" + f.id, c.e)).status, 404);
    r = await current(h, c.p, id);
    await ok(h, c.p, {
      action: "quote",
      id,
      expectedRevision: r.revision,
      supplier: "Anexo",
      prices: [9],
      freight: 0,
      days: 3,
      payment: "28 dias",
      scope: "Integral",
      files: [f.id],
    });
    const download = await h.fetch("/api/files/" + f.id, c.e);
    assert.equal(download.status, 200);
    assert.equal(await download.text(), "abcd");
    assert.match(download.headers.get("content-disposition"), /^attachment/);
    assert.equal((await h.fetch("/api/files/" + f.id, c.x)).status, 200);
    assert.equal((await h.fetch("/api/files/" + f.id, await h.login("unassigned"))).status,403);
    assert.equal(
      (
        await h.fetch("/api/files/" + f.id, c.p, {
          method: "PUT",
          body: "xxxx",
        })
      ).status,
      403,
    );
  } finally {
    await h.close();
  }
});

test("revisão, devolução com motivo, serviços, medições e autores preservam o fluxo", async () => {
  const { h, cookies: c } = await setup();
  try {
    let id = await request(h, c.a);
    let r = await current(h, c.e, id);
    assert.equal(
      (
        await command(h, c.e, {
          action: "reject",
          id,
          expectedRevision: r.revision,
          reason: "",
        })
      ).status,
      400,
    );
    await ok(h, c.e, {
      action: "reject",
      id,
      expectedRevision: r.revision,
      reason: "Especificação insuficiente",
    });
    r = await current(h, c.a, id);
    assert.equal(r.status, "returned");
    assert.equal(r.history.at(-1).actorId, "test-engineer");
    assert.match(r.history.at(-1).text, /Especificação/);
    await ok(h, c.a, {
      action: "edit",
      id,
      work: "ELYSIUM",
      expectedRevision: r.revision,
      purpose: "Revisado",
      items: [item],
    });
    assert.equal((await current(h, c.e, id)).status, "engineering");
    const service = {
      kind: "service",
      name: "Execução de alvenaria",
      unit: "m²",
      qty: 10,
      service: "alvenaria",
      neededDate: "2026-11-10",
      location: "Torre A",
    };
    r = await approved(h, c, [service]);
    await ok(h, c.d, {
      action: "director",
      id: r.id,
      expectedRevision: r.revision,
      decisions: [r.quotes[0].id],
      arrivals: ["2026-11-09"],
    });
    let s = await snapshot(h, c.e);
    assert.equal(s.orders.length, 0);
    assert.equal(s.contracts.length, 1);
    const ctr = s.contracts[0];
    assert.equal(
      (
        await command(h, c.a, {
          action: "measure",
          id: ctr.id,
          expectedRevision: 0,
          quantities: [3],
          period: "Novembro",
        })
      ).status,
      403,
    );
    await ok(h, c.e, {
      action: "measure",
      id: ctr.id,
      expectedRevision: 0,
      quantities: [3],
      period: "Novembro",
    });
    s = await snapshot(h, c.e);
    assert.equal(s.movements.length, 0);
    assert.equal(s.contracts[0].measurements[0].actorId, "test-engineer");
  } finally {
    await h.close();
  }
});

test("validação do servidor rejeita orçamento de outra obra, datas e quantidades inválidas", async () => {
  const { h, cookies: c } = await setup();
  try {
    for (const bad of [
      { ...item, service: "estrutura" },
      { ...item, qty: -1 },
      { ...item, neededDate: "2026-02-31" },
      { ...item, location: "" },
      { ...item, material: "inexistente" },
    ])
      assert.equal(
        (
          await command(h, c.a, {
            action: "create",
            work: "ELYSIUM",
            purpose: "Inválido",
            items: [bad],
          })
        ).status,
        400,
      );
    assert.equal((await snapshot(h, c.a)).requests.length, 0);
    const id = await request(h, c.a);
    const r = await current(h, c.e, id);
    assert.equal(
      (
        await command(h, c.e, {
          action: "engineering",
          id,
          expectedRevision: r.revision,
          services: ["estrutura"],
        })
      ).status,
      400,
    );
    assert.equal((await current(h, c.e, id)).status, "engineering");
  } finally {
    await h.close();
  }
});

test("adapter de produção não aceita identidades fictícias nem cabeçalhos forjados", async () => {
  const { createERPHandler } = await import("../../shared/api.mjs");
  const { requireSiteUser } = await import("../../hosting/sites-auth.mjs");
  const handler = createERPHandler(requireSiteUser);
  const response = await handler(
    new Request("https://erp.example/api/state", {
      headers: {
        "X-User-Id": "test-director",
        Cookie: "fes_dev_session=forged",
      },
    }),
    { DB: {}, BUCKET: {} },
  );
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /helper oficial/);
});
