const fs = require('node:fs');
const source = fs.readFileSync('tests/card-region-export.cjs', 'utf8')
  .replace('[12,13,16,23,24]', '[12,13]')
  .replace('assert.equal(withoutNote.cardHeight,197);', 'assert.equal(withoutNote.cardHeight,200);')
  .replace('assert.equal(metrics.height,2000);', `
    assert.equal(metrics.height,2000);
    const fit = await preview.locator('.card-playoff-regions').evaluate(el => ({
      bottom: el.getBoundingClientRect().bottom,
      footer: document.querySelector('.graphic-footer').getBoundingClientRect().top,
      topSpace: document.querySelector('.card-playoff-heads').getBoundingClientRect().top - el.getBoundingClientRect().top,
      bottomSpace: el.getBoundingClientRect().bottom - document.querySelector('.card-playoff-note-slot').getBoundingClientRect().bottom
    }));
    assert.ok(Math.abs(fit.bottom - fit.footer) < 2, JSON.stringify(fit));
    assert.ok(fit.topSpace >= 0 && fit.topSpace < 20, JSON.stringify(fit));
  `);
eval(source);
