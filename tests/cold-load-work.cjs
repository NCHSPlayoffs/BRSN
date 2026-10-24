const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('playoff_board.js','utf8');
let scans = 0, writes = 0, deferred = 0;
const context = vm.createContext({
  APP: {TeamNameNormalize:{}}, sportEl:{value:'Football'},
  canonicalTeamName_: value => value.toLowerCase(),
  teamDetailOptOutKeys_: team => { scans++; return new Set(team.aliases); },
  scheduleYearForRpiResult_: ()=>'live', liveDisplayTeamName_: name=>name,
  normalizeMaxPrepsUrl_: url=>url, teamDetailsMaxPrepsUrl_: team=>team?.url || '',
  cachedMaxPrepsUrl_: ()=>'', cacheMaxPrepsUrl_: (name,sport,url,defer)=>{assert.equal(defer,true);deferred++;},
  saveMaxPrepsUrlCache_: ()=>writes++
});
vm.runInContext(source.slice(source.indexOf('    function findTeamDetailByName_'),source.indexOf('    function numericRpi_')),context);
const teams = Array.from({length:100},(_,i)=>({aliases:['alias '+i],url:'https://example.com/'+i}));
const map = new Map(teams.map((t,i)=>['team '+i,t]));
const lookup = context.createTeamDetailLookup_(map,{});
for(let i=0;i<100;i++) assert.equal(lookup('alias '+i),context.findTeamDetailByName_(map,'alias '+i,{}));
scans=0;
const fresh = context.createTeamDetailLookup_(map,{});
for(let i=0;i<100;i++) fresh('alias '+i);
assert.equal(scans,100,'One alias-index build, not one full scan per row');
const rows=teams.map((_,i)=>({team:'alias '+i,rpi:'.5',record:'0-0'}));
const result=context.mergeRows_(rows,map,'Football',{},{});
assert.equal(result.length,100);
assert.equal(deferred,100);
assert.equal(writes,1,'One storage serialization per table');
assert.match(source,/getMergedRowsForCurrentSelection_\(\{ regionalHistory: false \}\)/);
console.log('100 teams: alias work reduced from 5,050 visits to 100; URL storage writes from 100 to 1.');
