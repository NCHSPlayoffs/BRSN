const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('playoff_board.js','utf8');
const start = source.indexOf('    function escapeRegex_');
const end = source.indexOf('    function splitAliasList_', start);
const context = vm.createContext({});
vm.runInContext(source.slice(start,end),context);
const cfg = {
  phraseReplacements:[{from:/&/g,to:' and '}],
  removeLeadingThe:true,removeTrailingSchool:true,
  removePhrases:['Academy'],removeTokens:[],
  acronymOverrides:{'original school':'The Arts & Science Academy!'}
};
const display = (name)=>context.liveDisplayTeamName_(name,cfg);
assert.equal(display('Original School'),'The Arts & Science Academy!');
assert.equal(display('The Arts & Science Academy!'),'The Arts & Science Academy!');
assert.equal(display('The Other Academy School'),'Other');
assert.equal(context.acronymKey_('Arts & Science'),context.acronymKey_('Arts and Science'));
assert.equal(context.canonicalTeamName_('Original School',cfg),'Arts and Science');
const directionCfg = {
  ...cfg,
  phraseReplacements: [{from:/\bsoutheast\b/ig,to:'SE'}, {from:/\bpreparatory\b/ig,to:'Prep'}],
  acronymOverrides: {'s e collegiate prep':'SE Collegiate'}
};
for (const name of ['S E Collegiate Prep','SE Collegiate Prep','Southeast Collegiate Prep','Southeast Collegiate Preparatory']) {
  assert.equal(context.liveDisplayTeamName_(name,directionCfg),'SE Collegiate');
  assert.equal(context.canonicalTeamName_(name,directionCfg),'SE Collegiate');
}
directionCfg.acronymOverrides = {'southeast collegiate prep':'SE Collegiate'};
assert.equal(context.liveDisplayTeamName_('S E Collegiate Prep',directionCfg),'SE Collegiate');
console.log('Display overrides preserve punctuation, ampersands and words; matching cleanup stays intact.');
