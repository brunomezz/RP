import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
const root = new URL('../../', import.meta.url);
async function run(db, name) {
  const sql = await readFile(new URL('migrations/' + name, root), 'utf8');
  await db.batch(sql.split(';').filter(s => s.trim()).map(s => db.prepare(s)));
}
test('migração 0006 move cadastros e movimentos existentes uma única vez, na ordem', async () => {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("")}}', d1Databases: { DB: 'm' } });
  try {
    const db = await mf.getD1Database('DB');
    const names = (await readdir(new URL('migrations/', root))).filter(n => n.endsWith('.sql')).sort();
    for (const n of names.filter(n => n < '0006')) await run(db, n);
    const old = { version: 2, requests: [], orders: [], contracts: [], budgetServices: { A: [] },
      catalog: [{ id: 'bloco', name: 'Bloco', unit: 'un' }, { name: 'Sem id', unit: 'kg' }],
      suppliers: [{ id: 's1', name: 'Fornecedor' }],
      movements: [{ id: 'm1', work: 'A', material: 'bloco', qty: 5, kind: 'in' }, { work: 'A', material: 'bloco', qty: 2, kind: 'out' }] };
    await db.prepare('UPDATE erp_state SET data=? WHERE id=1').bind(JSON.stringify(old)).run();
    const before = (await db.prepare('SELECT revision FROM erp_state').first()).revision;
    await run(db, '0006_stock_tables.sql');
    await run(db, '0006_stock_tables.sql');
    const rows = async t => (await db.prepare(`SELECT id,data FROM ${t} ORDER BY seq`).all()).results;
    assert.deepEqual((await rows('catalog_items')).map(r => r.id), ['bloco', 'MAT-1']);
    assert.equal(JSON.parse((await rows('catalog_items'))[1].data).id, 'MAT-1');
    assert.deepEqual((await rows('stock_movements')).map(r => r.id), ['m1', 'MOV-1']);
    assert.equal((await rows('supplier_rows')).length, 1);
    const agg = await db.prepare('SELECT data,revision FROM erp_state').first(), data = JSON.parse(agg.data);
    assert.equal(data.catalog, undefined); assert.equal(data.movements, undefined); assert.deepEqual(data.budgetServices, { A: [] });
    assert.equal(agg.revision, before + 1);
    const perms = (await db.prepare("SELECT role,permission FROM role_permissions WHERE permission IN ('reserve','stockClose') ORDER BY role,permission").all()).results;
    assert.deepEqual(perms.map(p => p.role + ':' + p.permission), ['almoxarifado:reserve', 'diretor:stockClose', 'engenharia:reserve']);
  } finally { await mf.dispose(); }
});
