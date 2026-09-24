const fs = require('node:fs');
const source = fs.readFileSync('tests/card-region-export.cjs','utf8')
  .replace('[12,13,16,23,24]', '[13]')
  .replace('for (const count of', `
    await page.evaluate(() => {
      const rows = Array.from({length:12},(_,i)=>({school:'School '+i,regionRank:i+1,rpi:'.5',record:'0-0',mapLogoUrl:'/NCHSAALOGO.png'}));
      window.cardTest.renderPlayoffCardPicture({east:rows,west:rows,total:24,excludedTeams:[]},'1A','Football','east');
      document.getElementById('cardGhostCount').value='1';
      document.getElementById('cardGhostApply').click();
    });
    assert.equal(await page.locator('.card-playoff-rank-number').count(),13);
    assert.equal(await page.locator('.card-playoff-winner-vs').count(),1);
    assert.equal(await page.locator('.card-playoff-mascot').filter({hasText:'TEST TEAM'}).count(),1);
    await page.evaluate(()=>document.getElementById('cardGhostReset').click());
    assert.equal(await page.locator('.card-playoff-rank-number').count(),12);
    await page.evaluate(()=>{
      document.getElementById('cardGhostCount').value='-3';
      document.getElementById('cardGhostApply').click();
    });
    assert.deepEqual(await page.locator('.card-playoff-rank-number').allTextContents().then(values=>values.map(Number).sort((a,b)=>a-b)),[1,2,3,4,5,6,7,8,9]);
    await page.evaluate(()=>document.getElementById('cardGhostReset').click());
    assert.equal(await page.locator('.card-playoff-rank-number').count(),12);
    for (const count of`)
  .replace('assert.equal(metrics.height,2000);', `
    assert.equal(await preview.locator('.card-playoff-winner-vs').count(),1);
    const badge = await preview.locator('.card-playoff-winner-vs').evaluate(e=>({position:getComputedStyle(e).position,box:e.getBoundingClientRect().toJSON()}));
    assert.equal(badge.position,'absolute');
    console.log(badge);
    assert.equal(metrics.height,2000);`);
eval(source);
