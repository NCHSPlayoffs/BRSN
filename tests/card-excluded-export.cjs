const fs = require('node:fs');
const source = fs.readFileSync('tests/card-region-export.cjs', 'utf8')
  .replace('[12,13,16,23,24]', '[24]')
  .replace('excludedTeams:[]', "excludedTeams:[{school:'Excluded East School',label:'Excluded East School',record:'0-4-0',longitude:-76}]")
  .replace("regionRank:i+1,record:", "longitude:-78,regionRank:i+1,record:")
  .replace("'3A','Football','east'", "'1A','Boys Soccer','east'")
  .replace('assert.equal(metrics.height,2000);', `assert.equal(metrics.height,2000); assert.equal(await preview.locator('.excluded-teams-note').count(),1);`);
eval(source);
