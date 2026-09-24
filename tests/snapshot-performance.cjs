const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('playoff_board.js', 'utf8');
let calls = 0;
let fail = false;
const context = vm.createContext({
  fetchSnapshotApiJson_: async () => { calls++; if (fail) throw new Error('offline'); return { ok: true }; }
});
vm.runInContext(source.slice(source.indexOf('    const snapshotReadCache_'), source.indexOf('    async function fetchSnapshotApiJson_')), context);
(async () => {
  await Promise.all(Array.from({ length: 8 }, () => context.requestSnapshotApiJson_('/rpi-snapshots/snapshot', { id: 'same' })));
  assert.equal(calls, 1, 'Concurrent reads share one request');
  await context.requestSnapshotApiJson_('/rpi-snapshots/snapshot', { id: 'same' });
  assert.equal(calls, 1, 'Saved snapshots reused across boards/exports');
  fail = true;
  await assert.rejects(context.requestSnapshotApiJson_('/rpi-snapshots/snapshot', { id: 'retry' }));
  fail = false;
  await context.requestSnapshotApiJson_('/rpi-snapshots/snapshot', { id: 'retry' });
  assert.equal(calls, 3, 'Failures are not cached');
  const ranks = [
    { school: 'A', regionRank: 1, lineRegion: 'East' },
    { school: 'B', regionRank: 2, lineRegion: 'East' }
  ];
  Object.assign(context, {
    canonicalTeamName_: name => name,
    buildEastWestLineRows_: rows => ({ east: rows, west: [] }),
    requestSnapshotApiJson_: async (path, params) => {
      calls++;
      return path.endsWith('/list') ? { snapshots: ['recent', 'older', 'unused'].map((id, i) => ({ id, fetchedAt: `2026-09-${19-i}`, source: 'official', seasonYear: 'live' })) }
        : { snapshot: { rows: params.id === 'recent' ? ranks : ranks.map(row => ({ ...row, regionRank: 3 - row.regionRank })) } };
    }
  });
  vm.runInContext(source.slice(source.indexOf('    async function fetchRegionalLastRows_'), source.indexOf('    async function addRegionalRankHistory_')), context);
  calls = 0;
  const history = await context.fetchRegionalLastRows_(ranks, ranks, 'Football', '3A', '2026-09-19', snapshot => snapshot.rows);
  assert.equal(history.length, 2);
  assert.equal(calls, 3, 'Stop before unused history once all movement is found');
  calls = 0;
  await context.fetchRegionalLastRows_(ranks, ranks.map(row => ({ ...row, regionRank: 3 - row.regionRank })), 'Football', '3A', '2026-09-19', snapshot => snapshot.rows);
  assert.equal(calls, 0, 'No history fetch when direct comparison already has changes');
  console.log('Snapshot caching and early-stop checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
