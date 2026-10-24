const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const raw=require('../supabase/functions/_shared/team-name-normalize.config.json');
const cfg={...raw,phraseReplacements:raw.phraseReplacements.map(r=>({from:new RegExp(r.pattern,r.flags),to:r.to})),acronymOverrides:{...raw.acronymOverrides,'north carolina leadership academy':'NCLA','college prep and leadership academy':'CPLA'}};
for(const file of ['playoff_board.js','server-headless-export-v2.js','supabase/functions/rpi-api/index.ts']) {
  let source=fs.readFileSync(file,'utf8');
  if(file.endsWith('.ts')) source=stripTypeScriptTypes(source);
  const browser=file==='playoff_board.js';
  const names=browser?['escapeRegex_','acronymKey_','applyAcronymOverrides_','canonicalTeamName_','teamNameMatcher_','teamNameMatchKey_','normalizeTeamNameText_']:['escapeRegex','acronymKey','applyAcronymOverrides','normalizeTeamKey'];
  const functions=browser?source.slice(source.indexOf('    function escapeRegex_'),source.indexOf('    function splitAliasList_')):names.map(name=>{
    const match=source.match(new RegExp('(^[ \\t]*)function '+name+'\\([^]*?^\\1}', 'm'));
    assert.ok(match,name);return match[0];
  }).join('\n');
  const context={cfg,APP:{TeamNameNormalize:cfg},TEAM_NAME_NORMALIZE:cfg};
  vm.createContext(context);vm.runInContext(functions,context);
  const normalize=context[browser?'canonicalTeamName_':'normalizeTeamKey'];
  assert.equal(normalize('The North Carolina Leadership Academy',cfg).toLowerCase(),'ncla');
  assert.equal(normalize('NCLA',cfg).toLowerCase(),'ncla');
  assert.equal(normalize('The College Prep & Leadership Academy',cfg).toLowerCase(),'cpla');
  assert.equal(normalize('Other Academy',cfg).toLowerCase(),'other academy');
  const history=new Map([[normalize('The North Carolina Leadership Academy',cfg),.62755]]);
  assert.equal(Number((.59191-history.get(normalize('NCLA',cfg))).toFixed(5)),-.03564);
}
console.log('Browser, local server, and Supabase normalization match overridden historical names.');
