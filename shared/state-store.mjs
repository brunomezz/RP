// Operational state: the small aggregate stays in erp_state; registers and stock
// live in their own tables (one row per record) so they do not count toward the
// aggregate's 1 MiB limit. All writes still share erp_state.revision.
export const tables = {
  catalog: 'catalog_items',
  suppliers: 'supplier_rows',
  movements: 'stock_movements',
  reservations: 'stock_reservations',
  locations: 'stock_locations',
  closings: 'stock_closings',
};
export async function loadState(db) {
  const [rowResult, ...rows] = await db.batch([
    db.prepare('SELECT * FROM erp_state WHERE id=1'),
    ...Object.values(tables).map(t => db.prepare(`SELECT data FROM ${t} ORDER BY seq`)),
  ]);
  const row = rowResult.results[0], state = JSON.parse(row.data);
  Object.keys(tables).forEach((k, i) => state[k] = rows[i].results.map(r => JSON.parse(r.data)));
  return { row, state };
}
export function snapshot(state) {
  return Object.fromEntries(Object.keys(tables).map(k => [k, new Map(state[k].map(r => [r.id, JSON.stringify(r)]))]));
}
export function aggregateData(state) {
  const copy = { ...state };
  for (const k of Object.keys(tables)) delete copy[k];
  return JSON.stringify(copy);
}
// Rows changed since `before`, written only if the aggregate update for `operation` won.
export function rowWrites(db, state, before, operation) {
  const statements = [];
  for (const [k, table] of Object.entries(tables))
    for (const r of state[k]) {
      if (!r.id) throw Object.assign(Error('Registro sem identificador.'), { status: 500 });
      const data = JSON.stringify(r);
      if (before[k].get(r.id) !== data)
        statements.push(db.prepare(`INSERT INTO ${table}(id,data) SELECT ?,? FROM erp_state WHERE id=1 AND last_operation=? ON CONFLICT(id) DO UPDATE SET data=excluded.data`).bind(r.id, data, operation));
    }
  return statements;
}
