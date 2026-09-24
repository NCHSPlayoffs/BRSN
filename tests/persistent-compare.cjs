const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('playoff_board.js', 'utf8');
const anchor = { id: 'original', sport: 'Football', classification: '1A', source: 'official', seasonYear: 'live', fetchedAt: '2026-09-12T12:00:00Z' };
const context = vm.createContext({
  compareSnapshotId_: anchor.id, compareSnapshotAnchor_: anchor,
  teamLogLocalDateKey_: value => value.slice(0, 10),
  requestSnapshotApiJson_: async (_, params) => ({ snapshots: [
    { ...anchor, ...params, id: 'previous-day', fetchedAt: '2026-09-11T23:00:00Z' },
    { ...anchor, ...params, id: 'older', fetchedAt: '2026-09-10T12:00:00Z' },
    { ...anchor, ...params, id: 'close-but-after', fetchedAt: '2026-09-12T12:05:00Z' },
    { ...anchor, ...params, id: 'far', fetchedAt: '2026-09-12T16:00:00Z' },
    { ...anchor, ...params, id: 'wrong-day', fetchedAt: '2026-09-13T12:00:00Z' }
  ] })
});
vm.runInContext(source.slice(source.indexOf('    async function resolveCompareSnapshotId_('), source.indexOf('    async function addLiveRpiChangeData_(')), context);
(async () => {
  assert.equal(await context.resolveCompareSnapshotId_('Football', '1A'), 'original');
  assert.equal(await context.resolveCompareSnapshotId_('Football', '2A'), 'previous-day');
  assert.equal(await context.resolveCompareSnapshotId_('Volleyball', '8A'), 'previous-day');
  assert.equal(context.compareSnapshotId_, 'original');
  context.requestSnapshotApiJson_ = async () => ({ snapshots: [
    { ...anchor, classification: '2A', id: 'exact' },
    { ...anchor, classification: '2A', id: 'earlier', fetchedAt: '2026-09-12T11:00:00Z' }
  ] });
  assert.equal(await context.resolveCompareSnapshotId_('Football', '2A'), 'exact');
  context.requestSnapshotApiJson_ = async () => ({ snapshots: [
    { ...anchor, classification: '2A', fetchedAt: '2026-09-12T23:00:00Z' }
  ] });
  await assert.rejects(context.resolveCompareSnapshotId_('Football', '2A'), /at or before/);
  context.requestSnapshotApiJson_ = async () => ({ snapshots: [] });
  await assert.rejects(context.resolveCompareSnapshotId_('Football', '3A'), /No .* snapshot/);
  const resetForTable = source.slice(source.indexOf('    function resetSnapshotSelectionsForNewTable_('), source.indexOf('    function openDatePicker_('));
  assert.doesNotMatch(resetForTable, /compareSnapshot(?:Id|Anchor|Label)_\s*=/);
  console.log('Persistent comparison checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
