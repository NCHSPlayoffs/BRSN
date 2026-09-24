const fs = require('node:fs');
const source = fs.readFileSync('tests/card-region-export.cjs', 'utf8')
  .replace('[12,13,16,23,24]', '[12]')
  .replace('rows[count-1].isOddExtra=true;', "rows[0].comparisonGameResult='win'; rows[1].comparisonGameResult='loss'; rows[count-1].isOddExtra=true;")
  .replace('assert.equal(withoutNote.cardHeight,197);', 'assert.equal(withoutNote.cardHeight,200);')
  .replace('assert.equal(metrics.height,2000);', `
    assert.equal(metrics.height,2000);
    assert.equal(await preview.locator('.card-playoff-result-arrow').count(), 2);
    const fits = await preview.locator('.card-playoff-result-arrow').evaluateAll(arrows => arrows.every(arrow => {
      const box = arrow.parentElement.getBoundingClientRect();
      const cell = arrow.closest('.card-playoff-stat').getBoundingClientRect();
      return box.left >= cell.left && box.right <= cell.right;
    }));
    assert.ok(fits, 'Record and result arrow fit inside the stat column');
  `);
eval(source);
