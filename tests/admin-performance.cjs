const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('playoff_board.js', 'utf8');
const context = vm.createContext({Map, Set});
vm.runInContext(source.slice(source.indexOf('    function escapeRegex_'), source.indexOf('    function splitAliasList_')), context);
const cfg = {
  phraseReplacements: [{from:/\bsoutheast\b/ig, to:'SE'}],
  removePhrases:['high school', 'academy'], removeTokens:['stem'],
  acronymOverrides: Object.fromEntries(Array.from({length:25}, (_,i) => ['Original School '+i, 'School '+i]))
};
const start = performance.now();
for (let i=0; i<3000; i++) context.canonicalTeamName_('Southeast Team '+i+' Academy', cfg);
console.log('3000 normalizations:', Math.round(performance.now()-start)+'ms');

const teams = Array.from({length:450}, (_,i) => ({name:'School '+String(i).padStart(3,'0'), aliases:'Alias '+i, teamClass:'Class '+(i%8+1)+'A'}));
let normalizations = 0;
const original = context.canonicalTeamName_;
Object.assign(context, {
  normalizeClassKey_: value => value || 'all',
  liveTeamNameNormalizeForSport_: () => cfg,
  splitAliasList_: value => String(value || '').split(',').filter(Boolean),
  teamDetailsMapResolved_: new Map(teams.flatMap((team,i) => [[i,team], ['duplicate '+i,team]])),
  canonicalTeamName_: (...args) => { normalizations++; return original(...args); }
});
vm.runInContext(source.slice(source.indexOf('    const teamSearchIndexes_'), source.indexOf('    function teamJumpNormalizeCfg_')), context);
assert.equal(context.adminTeamSearchRows_('all','all','').length,30);
normalizations=0;
for (const query of ['s','sc','sch','scho','school 04']) context.adminTeamSearchRows_('all','all',query);
assert.equal(normalizations,5,'Only query normalization on keystrokes; no alias rescans');
assert.ok(context.adminTeamSearchRows_('all','Class 2A','').every(row=>row.teamClass==='Class 2A'));
assert.equal(context.adminTeamSearchRows_('all','all','Alias 449')[0].name,'School 449');
context.teamDetailsMapResolved_ = new Map([[1,{name:'New Team',teamClass:'Class 1A'}]]);
assert.equal(context.adminTeamSearchRows_('all','all','New Team')[0].name,'New Team','TeamDetails replacement invalidates index');
cfg.acronymOverrides = {'s e collegiate prep':'SE Collegiate'};
assert.equal(context.liveDisplayTeamName_('Southeast Collegiate Prep',cfg),'SE Collegiate','Matcher invalidates when overrides change');
console.log('450 teams: search normalizes only the query, respects class/aliases, and rebuilds on data replacement.');
