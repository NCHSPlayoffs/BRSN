const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('playoff_board.js','utf8');
const cfg = {phraseReplacements:[],removePhrases:[],removeTokens:[],acronymOverrides:{'north carolina school for the deaf':'NC School for the Deaf'}};
const team = {name:'North Carolina School for the Deaf',longitude:-81.69};
const context = vm.createContext({Map,Set,
  getOptOutEntriesForSportClass_:()=>['N C School for the Deaf'],
  teamDetailOptOutKeys_:()=>new Set(['N C School for the Deaf','NC School for the Deaf']),
  classEl:{value:'Class 1A'}
});
vm.runInContext(source.slice(source.indexOf('    function escapeRegex_'),source.indexOf('    function splitAliasList_')),context);
vm.runInContext(source.slice(source.indexOf('    function filterOptedOutTeams_'),source.indexOf('    // ============================================================================',source.indexOf('    function filterOptedOutTeams_'))),context);
const rows = [{school:'N C School for the Deaf',record:'0-0-0',longitude:-81.69},{school:'Other Team',record:'1-0-0'}];
const details = new Map([['deaf',team]]);
let result = context.filterOptedOutTeams_(rows,'boys_soccer',details,{},cfg,{});
assert.equal(result.rows.length,1);
assert.equal(result.rows[0].school,'Other Team');
assert.equal(result.excludedTeams[0].label,'NC School for the Deaf');
assert.equal(result.excludedTeams[0].longitude,-81.69);
assert.equal(result.excludedTeams[0].record,'0-0-0');
cfg.acronymOverrides = {};
result = context.filterOptedOutTeams_(rows,'boys_soccer',details,{},cfg,{});
assert.equal(result.excludedTeams[0].label,'N C School for the Deaf','Existing opt-out label remains when there is no override');
console.log('Excluded labels resolve TeamDetails display overrides without changing exclusions, location, or record.');
