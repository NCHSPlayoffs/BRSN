const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const source = fs.readFileSync('supabase/functions/rpi-api/index.ts', 'utf8');
let limit;
let writes = 0;
const context = vm.createContext({
  TEAM_NAME_NORMALIZE: {},
  normalizeSnapshotRows: rows => rows,
  snapshotHash: async rows => rows[0].hash,
  selectSnapshots: async (_, requestedLimit) => {
    limit = requestedLimit;
    return [{ rowHash: 'unchanged', fetchedAt: '2026-09-23', rows: [] }];
  },
  insertSnapshot: async snapshot => { writes++; return { fetchedAt: snapshot.fetched_at }; }
});
vm.runInContext(stripTypeScriptTypes(source.slice(source.indexOf('async function compareSnapshots('), source.indexOf('function isAuthorizedMutation('))), context);
(async () => {
  const payload = { sport: 'Volleyball', classification: 'Class 1A', captureOnly: true, rows: [{ hash: 'unchanged' }] };
  assert.equal((await context.compareSnapshots(payload, true)).saved, false);
  assert.equal(limit, 1);
  assert.equal(writes, 0);
  payload.rows[0].hash = 'changed';
  assert.equal((await context.compareSnapshots(payload, true)).saved, true);
  assert.equal(writes, 1);
  await context.compareSnapshots(payload, false);
  assert.equal(limit, 200, 'Unauthenticated comparison cannot enable capture-only behavior');
  assert.equal(writes, 1);
  console.log('Capture-only checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
