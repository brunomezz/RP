import { reportRoutes } from './report-email.mjs';
import { documentRoutes } from './documents.mjs';
import { notificationRoutes, operationNotice } from './notifications.mjs';
import { loadActor, registerIdentity, allow, securitySnapshot, changeSecurity } from './security.mjs';
import { capabilities, can } from './permissions.mjs';
import {
  approveEngineering,
  sendDirector,
  reject,
  approveDirector,
  receive,
  withdraw,
  measure,
  normalizeText,
  validTaxId,
  formatTaxId,
  nextMaterialCode,
} from "../domain.mjs";
const labels = {
  create: "Solicitação criada",
  edit: "Solicitação revisada",
  engineering: "Necessidade aprovada",
  quote: "Proposta cadastrada",
  suggest: "Fornecedores sugeridos",
  send: "Enviado ao diretor",
  reject: "Devolução",
  director: "Contratação aprovada",
  arrival: "Previsão de chegada atualizada",
  receive: "Recebimento registrado",
  withdraw: "Saída de estoque",
  measure: "Medição registrada",
  material: "Insumo salvo",
  supplier: "Fornecedor atualizado",
  quoteFiles: "Anexos da proposta registrados",
  orderFiles: "Anexos do pedido registrados",
};
const MAX_FILE = 10 * 1024 * 1024,
  MAX_JSON = 256 * 1024;
function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
function text(v, label, max = 2000) {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    fail(400, "Confira " + label + ".");
  return v.trim();
}
function optional(v, max = 2000) {
  if (v == null) return "";
  if (typeof v !== "string" || v.length > max) fail(400, "Texto inválido.");
  return v.trim();
}
function number(v, label, positive = false) {
  if (
    typeof v !== "number" ||
    !Number.isFinite(v) ||
    v < 0 ||
    (positive && v === 0) ||
    v > 1e9
  )
    fail(400, "Confira " + label + ".");
  return v;
}
function date(v) {
  text(v, "data", 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v
  )
    fail(400, "Data inválida.");
  return v;
}
function list(v, max = 100) {
  if (!Array.isArray(v) || !v.length || v.length > max)
    fail(400, "Lista inválida.");
  return v;
}
const response = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function json(request) {
  const bytes = await readLimited(request, MAX_JSON);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail(400, "JSON inválido.");
  }
}
async function readLimited(request, max) {
  if (Number(request.headers.get("content-length")) > max)
    fail(413, "Arquivo ou comando excede o limite.");
  if (!request.body) fail(400, "Corpo obrigatório.");
  const reader = request.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        fail(413, "Arquivo ou comando excede o limite.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return bytes;
}
function readState(row) {
  return JSON.parse(row.data);
}
function projection(state, actor) {
  const visible = new Set(actor.access.map((a) => a.work_id));
  return {
    ...state,
    catalog: actor.access.length ? state.catalog : [],
    suppliers: actor.access.length ? state.suppliers : [],
    requests: state.requests.filter((r) => visible.has(r.work)),
    orders: state.orders.filter((r) => visible.has(r.work)),
    contracts: state.contracts.filter((r) => visible.has(r.work)),
    movements: state.movements.filter((r) => visible.has(r.work)),
    budgetServices: Object.fromEntries(
      Object.entries(state.budgetServices || {}).filter(([w]) =>
        visible.has(w),
      ),
    ),
  };
}
function find(state, kind, id) {
  const rows = {
    request: state.requests,
    order: state.orders,
    contract: state.contracts,
  }[kind];
  const record = rows?.find((r) => r.id === id);
  if (!record) fail(404, "Registro não encontrado.");
  return record;
}
function service(state, work, id, required = true) {
  const values = state.budgetServices?.[work] || [];
  if (!id && !required) return "";
  if (!values.some((s) => s.id === id))
    fail(400, "Serviço não pertence ao orçamento da obra.");
  return id;
}
function items(state, work, input) {
  return list(input).map((i) => {
    const kind = text(i.kind, "tipo", 20);
    if (!["material", "service"].includes(kind))
      fail(400, "Tipo de item inválido.");
    const m =
      kind === "material"
        ? state.catalog.find((m) => m.id === i.material)
        : null;
    if (kind === "material" && !m) fail(400, "Material não cadastrado.");
    return {
      kind,
      ...(m ? { material: m.id } : {}),
      name: m ? m.name : text(i.name, "descrição", 300),
      unit: m ? m.unit : text(i.unit, "unidade", 30),
      qty: number(i.qty, "quantidade", true),
      neededDate: date(i.neededDate),
      location: text(i.location, "local", 300),
      service: service(state, work, i.service, false),
    };
  });
}
function sameNames(rows, name) {
  return rows.some((s) => normalizeText(s.name) === normalizeText(name));
}
async function attachments(db, env, actor, ids, work, targetKind, targetId) {
  if (ids == null) return [];
  if (
    !Array.isArray(ids) ||
    ids.length > 20 ||
    new Set(ids).size !== ids.length
  )
    fail(400, "Anexos inválidos.");
  const files = [];
  for (const id of ids) {
    const f = await db
      .prepare("SELECT * FROM files WHERE id=?")
      .bind(text(id, "anexo", 100))
      .first();
    if (
      !f ||
      f.owner_id !== actor.id ||
      f.work_id !== work ||
      f.target_kind !== targetKind ||
      f.target_id !== targetId ||
      f.finalized ||
      !f.uploaded
    )
      fail(400, "Anexo não pertence a esta ação.");
    const obj = await env.BUCKET.head(f.id);
    if (!obj || obj.size !== f.size) fail(400, "Anexo incompleto.");
    files.push({
      id: f.id,
      name: f.name,
      size: f.size,
      type: "application/octet-stream",
    });
  }
  return files;
}
function expect(record, p) {
  if (
    !Number.isInteger(p.expectedRevision) ||
    p.expectedRevision !== (record.revision || 0)
  )
    fail(
      409,
      "Registro alterado por outra pessoa. Atualize e confira antes de repetir.",
    );
}
function quantities(v, rows) {
  if (!Array.isArray(v) || v.length !== rows.length)
    fail(400, "Quantidades inválidas.");
  return v.map((q) => number(q, "quantidade"));
}
async function apply(db, env, state, actor, p) {
  const action = p.action;
  if (!Object.hasOwn(labels, action)) fail(400, "Ação inválida.");
  let requiredPermission = action;
  let work = p.work,
    record,
    recordId,
    files = [];
  if (["create", "withdraw", "material", "supplier"].includes(action)) {
    allow(actor, work, action);
  } else {
    const kind = ["arrival", "receive", "orderFiles"].includes(action)
      ? "order"
      : action === "measure"
        ? "contract"
        : "request";
    record = find(state, kind, p.id);
    work = record.work;
    requiredPermission = action === "reject" ? (record.status === "director" ? "rejectDirector" : "rejectEngineering") : action;
    allow(actor, work, requiredPermission);
    expect(record, p);
  }
  let sourceDocument = null;
  if (p.sourceDocumentId) {
    if (!["create","quote"].includes(action)) fail(400,"Importação indisponível para esta ação.");
    allow(actor,work,"documentsImport");
    sourceDocument = await db.prepare("SELECT * FROM documents WHERE id=?").bind(text(p.sourceDocumentId,"documento",100)).first();
    if (!sourceDocument || sourceDocument.work_id!==work) fail(403,"Documento não pertence à obra.");
    if (sourceDocument.linked_record_id && !(action==="quote" && sourceDocument.linked_kind==="request" && sourceDocument.linked_record_id===record.id)) fail(409,"Documento já vinculado a outro registro.");
    if (await db.prepare("SELECT document_id FROM document_imports WHERE document_id=?").bind(sourceDocument.id).first()) fail(409,"Este PDF já originou um cadastro. Consulte o registro existente.");
  }
  const before = new Map(state.requests.map((r) => [r.id, r.history.length]));
  const movements = state.movements.length,
    orders = state.orders.length,
    contracts = state.contracts.length;
  let reason = optional(p.reason),
    result = {};
  recordId = record?.id || work;
  switch (action) {
    case "create": {
      record = {
        id: "SOL-" + crypto.randomUUID(),
        work,
        requester: actor.name,
        ...(sourceDocument?{sourceDocumentId:sourceDocument.id}:{}),
        purpose: text(p.purpose, "finalidade"),
        items: items(state, work, p.items),
        status: "engineering",
        quotes: [],
        decisions: [],
        allocations: [],
        history: [],
        revision: 0,
      };
      state.requests.push(record);
      recordId = record.id;
      result.id = record.id;
      break;
    }
    case "edit": {
      if (
        !["engineering", "returned", "quoting", "director"].includes(
          record.status,
        )
      )
        fail(409, "Revisão indisponível após a contratação.");
      if (p.work !== record.work)
        fail(400, "Não é possível transferir uma solicitação entre obras.");
      record.archivedQuotes = [
        ...(record.archivedQuotes || []),
        {
          at: new Date().toISOString(),
          items: record.items,
          quotes: record.quotes,
        },
      ];
      record.items = items(state, work, p.items);
      record.purpose = text(p.purpose, "finalidade");
      record.quotes = [];
      record.allocations = [];
      record.decisions = [];
      record.exception = "";
      record.status = "engineering";
      break;
    }
    case "engineering":
      list(p.services);
      if (p.services.length !== record.items.length)
        fail(400, "Vínculos inválidos.");
      record.items.forEach(
        (i, n) => (i.service = service(state, work, p.services[n])),
      );
      record.justification = optional(p.justification);
      approveEngineering(record);
      break;
    case "quote": {
      if (record.status !== "quoting") fail(409, "Cotação fora de etapa.");
      const supplier = text(p.supplier, "fornecedor", 300);
      if (
        record.quotes.length >= 30 ||
        record.quotes.some(
          (q) => normalizeText(q.supplier) === normalizeText(supplier),
        )
      )
        fail(400, "Fornecedor repetido ou limite de propostas atingido.");
      const prices = quantities(p.prices, record.items);
      prices.forEach((v) => number(v, "preço", true));
      const days = number(p.days, "prazo", true);
      if (!Number.isInteger(days)) fail(400, "Prazo inválido.");
      files = await attachments(
        db,
        env,
        actor,
        p.files,
        work,
        "request",
        record.id,
      );
      record.quotes.push({
        id: crypto.randomUUID(),
        supplier,
        ...(sourceDocument?{sourceDocumentId:sourceDocument.id}:{}),
        prices,
        days,
        freight: number(p.freight, "frete"),
        payment: text(p.payment, "pagamento"),
        scope: text(p.scope, "escopo"),
        attachments: files,
      });
      if (!sameNames(state.suppliers, supplier))
        state.suppliers.push({
          id: crypto.randomUUID(),
          name: supplier,
          document: "",
          contact: "",
          email: "",
          phone: "",
        });
      break;
    }
    case "suggest":
      if (record.status !== "quoting") fail(409, "Sugestão fora de etapa.");
      if (
        !Array.isArray(p.allocations) ||
        p.allocations.length !== record.items.length ||
        p.allocations.some(
          (id) => id && !record.quotes.some((q) => q.id === id),
        )
      )
        fail(400, "Sugestões inválidas.");
      record.allocations = p.allocations;
      record.quotes.forEach(
        (q) => (q.selected = p.allocations.every((id) => id === q.id)),
      );
      break;
    case "send":
      record.exception = optional(p.exception);
      sendDirector(record);
      break;
    case "reject":
      reason = text(p.reason, "motivo");
      reject(record, actor.name, reason);
      break;
    case "director": {
      if (
        !Array.isArray(p.decisions) ||
        p.decisions.length !== record.items.length ||
        !Array.isArray(p.arrivals) ||
        p.arrivals.length !== record.items.length
      )
        fail(400, "Decisões inválidas.");
      record.decisions = p.decisions;
      record.items.forEach(
        (i, n) => (i.estimatedArrival = date(p.arrivals[n])),
      );
      approveDirector(state, record);
      break;
    }
    case "arrival":
      if (
        !Array.isArray(p.arrivals) ||
        p.arrivals.length !== record.items.length
      )
        fail(400, "Previsões inválidas.");
      record.items.forEach(
        (i, n) => (i.estimatedArrival = date(p.arrivals[n])),
      );
      break;
    case "receive":
      files = await attachments(
        db,
        env,
        actor,
        p.files,
        work,
        "order",
        record.id,
      );
      receive(
        state,
        record,
        quantities(p.quantities, record.items),
        text(p.nf, "nota fiscal", 200),
        optional(p.note),
        files,
      );
      record.receipts.at(-1).actorId = actor.id;
      record.receipts.at(-1).who = actor.name;
      break;
    case "withdraw":
      service(state, work, p.service);
      if (!state.catalog.some((m) => m.id === p.material))
        fail(400, "Material não cadastrado.");
      if (p.expectedStateRevision !== state._revision)
        fail(409, "Estoque alterado. Atualize e confira.");
      withdraw(state, {
        work,
        material: p.material,
        qty: number(p.qty, "quantidade", true),
        who: text(p.recipient, "retirante", 300),
        service: p.service,
        floor: optional(p.floor, 300),
      });
      break;
    case "measure":
      measure(
        record,
        quantities(p.quantities, record.items),
        text(p.period, "período", 300),
      );
      record.measurements.at(-1).actorId = actor.id;
      record.measurements.at(-1).who = actor.name;
      break;
    case "quoteFiles": {
      if (record.status !== "quoting") fail(409, "Anexos fora de etapa.");
      const q = record.quotes.find((q) => q.id === p.quoteId);
      if (!q) fail(404, "Proposta não encontrada.");
      files = await attachments(
        db,
        env,
        actor,
        p.files,
        work,
        "request",
        record.id,
      );
      if (!files.length) fail(400, "Selecione anexos.");
      q.attachments = [...(q.attachments || []), ...files];
      break;
    }
    case "orderFiles":
      files = await attachments(
        db,
        env,
        actor,
        p.files,
        work,
        "order",
        record.id,
      );
      if (!files.length) fail(400, "Selecione anexos.");
      record.attachments.push(...files);
      break;
    case "material": {
      const existing = p.id ? state.catalog.find((m) => m.id === p.id) : null;
      if (p.id && !existing) fail(404, "Insumo não encontrado.");
      const name = text(p.name, "material", 300),
        unit = text(p.unit, "unidade", 30);
      if (state.catalog.some((m) => m.id !== existing?.id && normalizeText(m.name) === normalizeText(name)))
        fail(409, "Material já cadastrado.");
      const code =
        optional(p.code, 30).toUpperCase() ||
        existing?.code ||
        nextMaterialCode(state.catalog);
      if (state.catalog.some((m) => m.id !== existing?.id && (m.code || "").toUpperCase() === code))
        fail(409, "Código de insumo já utilizado.");
      if (
        existing &&
        existing.unit !== unit &&
        (state.movements.some((m) => m.material === existing.id) ||
          state.requests.some((r) => r.items.some((i) => i.material === existing.id)))
      )
        fail(409, "Unidade não pode ser alterada: o insumo já tem solicitações ou movimentos.");
      const data = {
        code,
        name,
        unit,
        category: optional(p.category, 100),
        spec: optional(p.spec, 300),
        brand: optional(p.brand, 100),
      };
      if (existing) Object.assign(existing, data);
      else state.catalog.push({ id: "MAT-" + crypto.randomUUID(), ...data });
      break;
    }
    case "supplier": {
      const name = text(p.name, "fornecedor", 300);
      const existing = p.id ? state.suppliers.find((s) => s.id === p.id) : null;
      if (p.id && !existing) fail(404, "Fornecedor não encontrado.");
      if (existing && existing.name !== name)
        fail(400, "Nome de fornecedor existente não pode ser alterado.");
      let document = optional(p.document, 100);
      if (document && !validTaxId(document))
        fail(400, "CNPJ/CPF inválido. Confira os dígitos.");
      document = formatTaxId(document);
      const uf = optional(p.uf, 2).toUpperCase();
      if (uf && !/^[A-Z]{2}$/.test(uf)) fail(400, "UF inválida.");
      if (
        state.suppliers.some(
          (s) =>
            s.id !== existing?.id &&
            (normalizeText(s.name) === normalizeText(name) ||
              (document.replace(/\D/g, "") &&
                s.document?.replace(/\D/g, "") ===
                  document.replace(/\D/g, ""))),
        )
      )
        fail(409, "Fornecedor já cadastrado.");
      const data = {
        name,
        document,
        contact: optional(p.contact, 300),
        email: optional(p.email, 300),
        phone: optional(p.phone, 100),
        legalName: optional(p.legalName, 300),
        address: optional(p.address, 300),
        city: optional(p.city, 100),
        uf,
        paymentTerms: optional(p.paymentTerms, 200),
        notes: optional(p.notes, 1000),
      };
      if (existing) Object.assign(existing, data);
      else state.suppliers.push({ id: crypto.randomUUID(), ...data });
      break;
    }
    default:
      fail(400, "Ação inválida.");
  }
  const at = new Date().toISOString(),
    entry = {
      at,
      who: actor.name,
      actorId: actor.id,
      text: (labels[action] || action) + (reason ? ": " + reason : "") + (sourceDocument ? " · Origem PDF: "+sourceDocument.name : ""),
    };
  for (const r of state.requests) {
    const count = before.get(r.id) ?? 0;
    for (const h of r.history.slice(count)) {
      h.who = actor.name;
      h.actorId = actor.id;
      h.at = at;
    }
    if (r.id === recordId || r.id === record?.requestId) {
      if (r.history.length === count) r.history.push({ ...entry });
      r.revision = (r.revision || 0) + 1;
    }
  }
  if (record && !state.requests.includes(record)) {
    record.revision = (record.revision || 0) + 1;
    record.history.push({ ...entry });
  }
  for (const m of state.movements.slice(movements)) {
    m.actorId = actor.id;
    m.actorName = actor.name;
    m.at = at;
    if (m.kind === "in") m.who = actor.name;
  }
  for (const o of [
    ...state.orders.slice(orders),
    ...state.contracts.slice(contracts),
  ]) {
    o.revision = 0;
    o.createdBy = actor.id;
    o.createdAt = at;
    o.history.push({ ...entry });
  }
  return { result, work, recordId, files, at, reason, requiredPermission, sourceDocument };
}
async function command(db, env, actor, p, key) {
  text(key, "identificador da ação", 100);
  const fingerprint = JSON.stringify(p);
  for (let retry = 0; retry < 8; retry++) {
    actor = await loadActor(db, actor);
    const prior = await db
      .prepare("SELECT * FROM operations WHERE actor_id=? AND key=?")
      .bind(actor.id, key)
      .first();
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        fail(409, "Identificador reutilizado para outra ação.");
      const saved = JSON.parse(prior.result);
      allow(actor, saved.work, saved.permission || (p.action === "reject" ? "rejectDirector" : p.action));
      return saved.result;
    }
    const row = await db.prepare("SELECT * FROM erp_state WHERE id=1").first(),
      state = readState(row);
    state._revision = row.revision;
    const latest = await db
      .prepare("SELECT * FROM operations WHERE actor_id=? AND key=?")
      .bind(actor.id, key)
      .first();
    if (latest) {
      if (latest.fingerprint !== fingerprint)
        fail(409, "Identificador reutilizado para outra ação.");
      const saved = JSON.parse(latest.result);
      allow(actor, saved.work, saved.permission || (p.action === "reject" ? "rejectDirector" : p.action));
      return saved.result;
    }
    const changed = await apply(db, env, state, actor, p);
    delete state._revision;
    const data = JSON.stringify(state);
    if (new TextEncoder().encode(data).length > 1024 * 1024)
      fail(
        413,
        "Capacidade desta versão atingida. Amplie o modelo antes de novos registros.",
      );
    const operation = crypto.randomUUID(),
      saved = JSON.stringify({ work: changed.work, result: changed.result, permission: changed.requiredPermission });
    const batch = [
      db
        .prepare(
          "UPDATE erp_state SET data=?,revision=revision+1,last_operation=? WHERE id=1 AND revision=? AND EXISTS(SELECT 1 FROM security_meta WHERE id=1 AND revision=?) AND (? IS NULL OR (NOT EXISTS(SELECT 1 FROM document_imports WHERE document_id=?) AND EXISTS(SELECT 1 FROM documents WHERE id=? AND work_id=? AND (linked_record_id IS NULL OR (linked_kind='request' AND linked_record_id=?)))))",
        )
        .bind(data, operation, row.revision, actor.securityRevision,changed.sourceDocument?.id||null,changed.sourceDocument?.id||null,changed.sourceDocument?.id||null,changed.work,p.action==="quote"?p.id:""),
      db
        .prepare(
          "INSERT INTO operations(actor_id,key,fingerprint,result) SELECT ?,?,?,? FROM erp_state WHERE id=1 AND last_operation=?",
        )
        .bind(actor.id, key, fingerprint, saved, operation),
      db
        .prepare(
          "INSERT INTO audit(id,work_id,record_id,actor_id,actor_name,action,at,reason,operation_id) SELECT ?,?,?,?,?,?,?,?,? FROM erp_state WHERE id=1 AND last_operation=?",
        )
        .bind(
          crypto.randomUUID(),
          changed.work,
          changed.recordId,
          actor.id,
          actor.name,
          p.action,
          changed.at,
          changed.reason,
          operation,
          operation,
        ),
    ];
    for (const f of changed.files)
      batch.push(
        db
          .prepare(
            "UPDATE files SET finalized=1 WHERE id=? AND EXISTS(SELECT 1 FROM erp_state WHERE id=1 AND last_operation=?)",
          )
          .bind(f.id, operation),
      );
    if (changed.sourceDocument) {
      batch.push(db.prepare("INSERT INTO document_imports(document_id,action,record_id,actor_id,created_at) SELECT ?,?,?,?,? FROM erp_state WHERE id=1 AND last_operation=?").bind(changed.sourceDocument.id,p.action,changed.recordId,actor.id,changed.at,operation));
      batch.push(db.prepare("UPDATE documents SET linked_kind='request',linked_record_id=? WHERE id=? AND EXISTS(SELECT 1 FROM erp_state WHERE id=1 AND last_operation=?)").bind(changed.recordId,changed.sourceDocument.id,operation));
    }
    batch.push(...operationNotice(db,actor,changed,operation,p.action,labels[p.action]));
    const result = await db.batch(batch);
    if (result[0].meta.changes === 1) return changed.result;
  }
  fail(409, "Outras ações estão em andamento. Atualize e tente novamente.");
}
export function createERPHandler(requireUser, options = {}) {
  return async function handle(request, env) {
    try {
      const path = new URL(request.url).pathname;
      if (!path.startsWith("/api/"))
        return response({ error: "Rota não encontrada." }, 404);
      if (!env.DB || !env.BUCKET)
        fail(503, "Bindings DB e BUCKET não configurados.");
      if (!["GET", "HEAD"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin)
          fail(403, "Origem inválida.");
        if (request.headers.get("sec-fetch-site") === "cross-site")
          fail(403, "Origem inválida.");
      }
      const user = await requireUser(request, env);
      if (path === "/api/identity" && request.method === "GET") {
        return response(await registerIdentity(env.DB, user));
      }
      const actor = await loadActor(env.DB, user);
      const helpers={json,readLimited,response,mailFetch:options.mailFetch?(r)=>options.mailFetch(r,env):fetch};
      for(const route of [notificationRoutes,documentRoutes,reportRoutes]){const result=await route(request,env,actor,helpers);if(result)return result;}
      if (path === "/api/session" && request.method === "GET") return response(actor);
      if (path === "/api/security" && request.method === "GET") return response(await securitySnapshot(env.DB, actor));
      if (path === "/api/security" && request.method === "POST")
        return response(await changeSecurity(env.DB, actor, await json(request), request.headers.get("Idempotency-Key")));
      if (path === "/api/state" && request.method === "GET") {
        const row = await env.DB.prepare(
          "SELECT * FROM erp_state WHERE id=1",
        ).first();
        const state = projection(readState(row), actor);
        return response({
          ...state,
          revision: row.revision,
          session: actor,
          works: [
            ...new Map(
              actor.access.map((a) => [
                a.work_id,
                { id: a.work_id, name: a.name },
              ]),
            ).values(),
          ],
        });
      }
      if (path === "/api/commands" && request.method === "POST")
        return response(
          await command(
            env.DB,
            env,
            actor,
            await json(request),
            request.headers.get("Idempotency-Key"),
          ),
        );
      if (path === "/api/audit" && request.method === "GET") {
        const audit = [];
        for (const work of new Set(actor.access.map((a) => a.work_id)))
          audit.push(
            ...(
              await env.DB.prepare(
                "SELECT * FROM audit WHERE work_id=? ORDER BY at DESC LIMIT 500",
              )
                .bind(work)
                .all()
            ).results,
          );
        return response(audit.sort((a, b) => b.at.localeCompare(a.at)));
      }
      if (path === "/api/files" && request.method === "POST") {
        const p = await json(request),
          row = await env.DB.prepare(
            "SELECT * FROM erp_state WHERE id=1",
          ).first(),
          state = readState(row);
        if (!["request", "order"].includes(p.targetKind))
          fail(400, "Destino de anexo inválido.");
        const record = find(state, p.targetKind, p.targetId);
        const requiredPermission = p.targetKind === "request"
          ? (p.purpose === "quoteFiles" ? "quoteFiles" : "quote")
          : p.purpose === "receipt" ? "receive" : "orderFiles";
        allow(actor, record.work, requiredPermission);
        if (p.targetKind === "request" && record.status !== "quoting")
          fail(409, "Proposta fora de etapa.");
        const size = number(p.size, "tamanho", true);
        if (size > MAX_FILE || !Number.isInteger(size))
          fail(413, "Cada anexo pode ter no máximo 10 MB.");
        const name = text(p.name, "nome do arquivo", 255).replace(
          /[\r\n\\/\x00-\x1f]/g,
          "_",
        );
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO files(id,work_id,target_kind,target_id,owner_id,name,size,created_at) VALUES(?,?,?,?,?,?,?,?)",
        )
          .bind(
            id,
            record.work,
            p.targetKind,
            record.id,
            actor.id,
            name,
            size,
            new Date().toISOString(),
          )
          .run();
        return response({ id, name, size }, 201);
      }
      const match = path.match(/^\/api\/files\/([a-f0-9-]+)$/);
      if (match) {
        const f = await env.DB.prepare("SELECT * FROM files WHERE id=?")
          .bind(match[1])
          .first();
        if (!f) fail(404, "Anexo não encontrado.");
        allow(actor, f.work_id);
        if (request.method === "PUT") {
          if (f.owner_id !== actor.id || f.finalized)
            fail(403, "Envio não autorizado.");
          const uploadPermissions = f.target_kind === "request" ? ["quote", "quoteFiles"] : ["receive", "orderFiles"];
          if (!uploadPermissions.some(permission => can(actor, permission, f.work_id))) fail(403, "Envio não autorizado.");
          const data = await readLimited(request, MAX_FILE);
          if (data.length !== f.size) fail(400, "Tamanho do anexo divergente.");
          const stored = await env.BUCKET.put(f.id, data, {
            onlyIf: { etagDoesNotMatch: "*" },
            httpMetadata: { contentType: "application/octet-stream" },
          });
          if (!stored) {
            const previous = await env.BUCKET.get(f.id);
            const previousBytes = new Uint8Array(await previous.arrayBuffer());
            if (
              previousBytes.length !== data.length ||
              previousBytes.some((b, i) => b !== data[i])
            )
              fail(409, "Anexo já enviado com outro conteúdo.");
          }
          await env.DB.prepare(
            "UPDATE files SET uploaded=1 WHERE id=? AND finalized=0",
          )
            .bind(f.id)
            .run();
          return response({ id: f.id });
        }
        if (request.method === "GET") {
          if (!f.finalized)
            fail(404, "Anexo ainda não vinculado a um registro.");
          const object = await env.BUCKET.get(f.id);
          if (!object) fail(404, "Arquivo indisponível.");
          return new Response(object.body, {
            headers: {
              "Content-Type": "application/octet-stream",
              "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      }
      return response({ error: "Rota não encontrada." }, 404);
    } catch (e) {
      const setup = /no such (table|column)|Bindings DB/.test(e.message || "");
      return response({ error: setup ? "Conclua as migrações e a configuração deste ambiente." : e.status ? e.message : e.message?.startsWith("D1_") ? "Falha de persistência." : e.message || "Erro interno.",
        code: setup ? "ERP_SETUP_REQUIRED" : e.code }, setup ? 503 : e.status || 400);
    }
  };
}
