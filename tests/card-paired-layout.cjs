const fs = require('node:fs');
const source = fs.readFileSync('tests/card-region-export.cjs','utf8')
  .replace('[12,13,16,23,24]', '[4,5,6,7,8,9,10,11,12,13,14,15,16]')
  .replace('assert.equal(metrics.height,2000);', `
    const pairs = await preview.locator('.card-playoff-row').evaluateAll(rows => rows.map((row,i) => {
      if (!row.querySelector('.card-playoff-winner-vs')) return null;
      return [row,rows[i+1]].map(r=>Number(r.children[2].querySelector('.card-playoff-rank-number').textContent));
    }).filter(Boolean));
    const size = 2 ** Math.ceil(Math.log2(count));
    const expectedPairs = Math.max(0,count - size * .75);
    assert.equal(pairs.length,expectedPairs,'Every second-round winner pairing is stacked for '+count);
    for(const pair of pairs) assert.equal(pair[0]+pair[1],size/2+1);
    assert.equal(metrics.height,2000);`);
eval(source);
