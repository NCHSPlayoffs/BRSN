const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('playoff_board.js', 'utf8');
let requests = 0;
let olderRecord = '4-2-0';
const context = vm.createContext({
  console,
  canonicalTeamName_: name => name.toLowerCase(),
  requestSnapshotApiJson_: async path => {
    requests++;
    return path.endsWith('/list') ? { snapshots: [
      { id: 'recent', source: 'official', seasonYear: 'live', fetchedAt: '2026-09-20T12:00:00Z' },
      { id: 'outside-window', source: 'official', seasonYear: 'live', fetchedAt: '2026-09-10T12:00:00Z' }
    ] } : { snapshot: { rows: [{ school: 'A', record: olderRecord }] } };
  }
});
vm.runInContext(source.slice(source.indexOf('    function recordResultSince_('), source.indexOf('    async function addRegionalRankHistory_(')), context);
for (const [current, old, expected] of [
  ['4-1-0', '3-1-0', 'win'], ['3-2', '3-1', 'loss'],
  ['3-1-0', '3-1-0', 'none'], ['3-1-1', '3-1-0', 'tie'],
  ['5-1', '3-1', 'win'], ['4-2', '3-1', 'mixed'],
  ['2-1', '3-1', 'unknown'], ['4-1', undefined, 'unknown']
]) assert.equal(context.recordResultSince_(current, old), expected);
const compare = { previousFetchedAt: '2026-09-18T12:00:00Z', fetchedAt: '2026-09-22T12:00:00Z' };
const calculate = (record, previous) => context.addComparisonGameResults_(
  [{ school: 'A', record }], [{ school: 'A', record: previous }], 'Football', '3A', compare, {}
);
(async () => {
  assert.equal((await calculate('4-1-0', '3-1-0'))[0].comparisonGameResult, 'win');
  assert.equal((await calculate('4-1-0', '4-1-0'))[0].comparisonGameResult, null, 'Bye/no game stays blank');
  assert.equal(requests, 0, 'Simple outcomes use the already loaded comparison, no extra requests');
  assert.equal((await calculate('5-2-0', '3-1-0'))[0].comparisonGameResult, 'win');
  olderRecord = '5-1-0';
  assert.equal((await calculate('5-2-0', '3-1-0'))[0].comparisonGameResult, 'loss');
  olderRecord = '5-2-0';
  assert.equal((await calculate('5-2-1', '3-1-0'))[0].comparisonGameResult, null, 'Latest tie does not reuse a prior win');
  olderRecord = '3-1-0';
  assert.equal((await calculate('5-2-0', '3-1-0'))[0].comparisonGameResult, null, 'Mixed results in one update are not guessed');
  console.log('Comparison game result checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
