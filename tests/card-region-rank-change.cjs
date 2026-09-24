const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('playoff_board.js', 'utf8');
const functions = source.slice(source.indexOf('    function buildEastWestLineRows_('), source.indexOf('    function regionInfoLookupForRows_('));
const context = vm.createContext({
  playoffEligibleCap_: () => 6,
  numericRpi_: Number,
  longitudeSortValue_: row => Math.abs(row.longitude),
  canonicalTeamName_: name => name.toLowerCase(),
  eastWestExtraSide_: () => 'east'
});
vm.runInContext(functions, context);
const original = ['A', 'B', 'C', 'D', 'E', 'F'].map((school, i) => ({
  school, rank: i + 1, rpi: 0.9 - i * 0.1, longitude: -70 - i, rankChange: 9, rpiChange: 0.123
}));
function compare(current, previous, lastRows = [], extraSide = 'east') {
  const rows = current.map(row => ({ ...row, regionRankHistory: previous ? { previousRows: previous, lastRows } : undefined }));
  const field = context.buildRegionRows_(rows, '3A', extraSide);
  return new Map([...field.east, ...field.west].map(row => [row.school, row]));
}
const crossRegion = original.map(row => ({ ...row, rpi: row.school === 'D' ? 0.75 : row.rpi }));
assert.equal(compare(crossRegion, original).get('C').regionRankChange, 0, 'Statewide movement must not imply regional movement');
const switchedOrder = original.map(row => ({ ...row, rpi: row.school === 'B' ? 0.95 : row.rpi }));
const changed = compare(switchedOrder, original);
assert.equal(changed.get('B').regionRankChange, 1);
assert.equal(changed.get('A').regionRankChange, -1);
assert.equal(changed.get('B').rankChange, 9, 'Keep statewide change untouched');
assert.equal(changed.get('B').rpiChange, 0.123, 'Keep numeric RPI change untouched');
const entrant = [...original, { school: 'G', rank: 1, rpi: 1, longitude: -69 }];
const shifted = compare(entrant, original);
assert.equal(shifted.get('C').regionRankChange, null, 'No arrow when changing regions');
assert.equal(shifted.get('G').regionRankChange, null, 'No arrow for newly qualifying teams');
assert.equal(shifted.has('F'), false, 'Apply historical and current eligibility caps separately');
assert.equal(compare(original, null).get('A').regionRankChange, null);
const last = compare(switchedOrder, switchedOrder, [switchedOrder, original]);
assert.equal(last.get('B').regionRankChange, 1, 'Last change uses adjacent regional snapshots');
assert.equal(compare(switchedOrder, switchedOrder).get('B').regionRankChange, 0, 'Explicit unchanged comparison stays zero');
for (const side of ['east', 'west']) {
  const odd = compare(original.slice(0, 5), original.slice(0, 5), [], side);
  assert.equal(odd.get('C').lineRegion, side === 'east' ? 'East' : 'West');
  assert.equal(odd.get('C').regionRankChange, 0);
}
assert.match(source, /cardPlayoffMoveClass_\(team\.regionRankChange\)/);
assert.match(source, /cardPlayoffMoveText_\(team\.regionRankChange\)/);
const loader = source.slice(source.indexOf('    async function addRegionalRankHistory_('), source.indexOf('    function classificationPostValues_('));
let requests = [];
Object.assign(context, {
  console: { warn() {} },
  requestSnapshotApiJson_: async (path, params) => {
    requests.push({ path, params });
    return { snapshot: { rows: original.slice().reverse() } };
  },
  mergeRows_: rows => rows.map(row => ({ ...row, school: row.team })),
  liveDisplayTeamName_: name => name,
  findTeamDetailByName_: (_, name) => original.find(row => row.school === name),
  fetchRegionalLastRows_: async (_, previous) => [previous],
  addComparisonGameResults_: async rows => rows,
  filterOptedOutTeams_: rows => ({ rows: rows.filter(row => row.school !== 'F') }),
  sportKeyFromLabel_: value => value,
  liveOptOutConfig_: {}, adminConfig_: {},
  fetchTeamLogSnapshotBundle_: async () => [
    { fetchedAt: '2026-09-18', rows: original },
    { fetchedAt: '2026-09-20', rows: original }
  ]
});
vm.runInContext(loader, context);
(async () => {
  const result = { changeCompare: { canCompare: true, compareSnapshotId: 'chosen', fetchedAt: '2026-09-19', includeLastChange: true } };
  const loaded = await context.addRegionalRankHistory_(original, 'Football', '3A', result, {}, {});
  assert.equal(requests[0].params.id, 'chosen');
  assert.equal(loaded[0].regionRankHistory.previousRows[0].school, 'A', 'Restore stored rank order');
  assert.equal(loaded[0].regionRankHistory.previousRows.length, 5, 'Apply current opt-outs to history');
  assert.equal(loaded[0].regionRankHistory.lastRows.length, 1, 'Do not compare against future snapshots');
  context.requestSnapshotApiJson_ = async () => { throw new Error('offline'); };
  const offline = await context.addRegionalRankHistory_(original, 'Football', '3A', result, {}, {});
  assert.equal(compare(offline, null).get('A').regionRankChange, null, 'Failed history must never fall back to statewide movement');
  console.log('Regional card movement and snapshot loading: all assertions passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
