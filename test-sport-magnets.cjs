const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const root of ['http://localhost:8125/winter/', 'http://localhost:8139/']) {
      const page = await browser.newPage({viewport:{width:900,height:300}});
      await page.route('**/sport-magnet-test', route => route.fulfill({contentType:'text/html',body:`<!doctype html><base href="${root}"><link rel="stylesheet" href="whiteboard-playoff.css"><body></body>`}));
      await page.goto(root + 'sport-magnet-test');
      await page.addScriptTag({url:root + 'whiteboard-playoff.js'});
      const results = await page.evaluate(async () => {
        const results = [];
        for (const sport of ['Girls Soccer','Girls Basketball','Boys Soccer','Boys Basketball']) {
          const board = document.createElement('div');
          board.dataset.region = 'east';
          board.innerHTML = '<h1 class="card-banner-heading">' + sport + '</h1>';
          document.body.append(board);
          window.WhiteboardPlayoff.apply(board,sport);
          const image = board.querySelector('.wb-sport-magnet');
          await image.decode();
          results.push({sport,src:image.getAttribute('src'),loaded:image.naturalWidth>0,filter:getComputedStyle(image).filter});
        }
        return results;
      });
      for (const result of results) {
        assert.ok(result.loaded);
        assert.equal(result.src.includes('-pink.png'),result.sport.startsWith('Girls'));
        assert.equal(result.filter,'none');
      }
      await page.evaluate(() => {
        document.body.style.cssText='display:flex;gap:30px;padding:30px;background:#e5e7e9';
        document.querySelectorAll('.whiteboard-playoff').forEach(board=>{
          const magnet=board.querySelector('.wb-sport-magnet');
          board.replaceChildren(magnet);
          board.style.cssText='position:relative;width:170px;height:200px;min-width:0';
          magnet.style.cssText='left:85px;top:100px;width:140px;height:140px';
        });
      });
      if (root.includes('8139')) await page.screenshot({path:'sport-magnets-preview.png'});
      await page.close();
    }
    console.log('PASS: Girls pink assets and boys originals load without added CSS cutout, depth, or shadow on both boards.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
