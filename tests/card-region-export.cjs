const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const source = fs.readFileSync('playoff_board.js', 'utf8');
    await page.route('**/playoff_board.js*', r => r.fulfill({contentType:'text/javascript', body:source.replace('function renderPlayoffCardPicture(', 'window.cardTest={renderPlayoffCardPicture,buildServerExportHtml_}; function renderPlayoffCardPicture(')}));
    await page.goto('http://localhost:8124/playoff_board.html');
    await page.waitForFunction(() => window.cardTest);
    for (const count of [12,13,16,23,24]) {
      const html = await page.evaluate(count => {
        const rows = Array.from({length:count}, (_,i) => ({school:i===10?'SE Collegiate Prep Academy':`School ${i+1}`,regionRank:i+1,record:'3-1-0',rpi:'0.65432',mapLogoUrl:'/NCHSAALOGO.png',rankChange:1,rpiChange:0.01234}));
        rows[count-1].isOddExtra=true; rows[count-1].lineRegion='East';
        window.cardTest.renderPlayoffCardPicture({west:rows,east:rows,total:count*2,excludedTeams:[]},'3A','Football','east');
        return window.cardTest.buildServerExportHtml_();
      },count);
      const preview = await browser.newPage({viewport:{width:1600,height:2000},deviceScaleFactor:2});
      await preview.setContent(html,{waitUntil:'networkidle'});
      await preview.evaluate(() => document.fonts.ready);
      const metrics=await preview.locator('.sports-graphic').evaluate(board=>({height:board.getBoundingClientRect().height,footer:board.querySelector('.graphic-footer').getBoundingClientRect().bottom,content:board.querySelector('.card-playoff-rows').getBoundingClientRect().bottom,seeds:[...board.querySelectorAll('.card-playoff-rank-number')].map(el=>Number(el.textContent)),first:[...board.querySelector('.card-playoff-row').querySelectorAll('.card-playoff-rank-number')].map(el=>Number(el.textContent))}));
      assert.equal(metrics.height,2000);
      const layout = await preview.locator('.sports-graphic').evaluate(board => ({
        cardHeights: [...board.querySelectorAll('.card-playoff-team')].map(el => el.getBoundingClientRect().height),
        subtitleBottom: board.querySelector('.card-playoff-title').getBoundingClientRect().bottom,
        headsTop: board.querySelector('.card-playoff-heads').getBoundingClientRect().top
      }));
      assert.ok(layout.cardHeights.every(height => height === 200), JSON.stringify(layout));
      assert.ok(layout.subtitleBottom <= layout.headsTop, JSON.stringify(layout));
      assert.ok(metrics.footer<=2000,JSON.stringify(metrics));
      assert.ok(metrics.content<metrics.footer,JSON.stringify(metrics));
      assert.deepEqual([...metrics.seeds].sort((a,b)=>a-b),Array.from({length:count},(_,i)=>i+1));
      if(count===24) assert.deepEqual(metrics.first,[1,16,17]);
      if(count===13) assert.deepEqual(metrics.first,[1,8,9]);
      const png=await preview.locator('.sports-graphic').screenshot({path:`style-previews/card-east-${count}.png`});
      assert.equal(png.readUInt32BE(16),3200); assert.equal(png.readUInt32BE(20),4000);
      const withoutNote = await preview.locator('.sports-graphic').evaluate(board => {
        board.querySelectorAll('.odd-extra-note').forEach(el => el.remove());
        return {footer:board.querySelector('.graphic-footer').getBoundingClientRect().bottom,cardHeight:board.querySelector('.card-playoff-team').getBoundingClientRect().height};
      });
      assert.equal(withoutNote.footer,metrics.footer);
      assert.equal(withoutNote.cardHeight,200);
      console.log(count,metrics); await preview.close();
    }
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
