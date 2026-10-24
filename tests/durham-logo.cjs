const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async()=>{
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const source = fs.readFileSync('playoff_board.js','utf8');
    await page.route('**/playoff_board.js*',route=>route.fulfill({contentType:'text/javascript',body:source.replace('function renderPlayoffCardPicture(', 'window.durhamTest={renderPlayoffCardPicture,setViewMode_}; function renderPlayoffCardPicture(')}));
    await page.goto('http://localhost:8138/playoff_board.html');
    await page.waitForFunction(()=>window.durhamTest);
    for(const side of ['east','west']) {
      await page.evaluate(side=>{
        const rows = ['Renamed Durham','Other School'].map((school,i)=>({school,originalSchool:i===0?'Durham Charter':school,rank:i+1,regionRank:i+1,rpi:'.5',record:'1-0-0',mapLogoUrl:'/NCHSAALOGO.png'}));
        window.durhamTest.setViewMode_('playoff');
        window.durhamTest.renderPlayoffCardPicture({east:rows,west:rows,total:4},'Class 1A','Boys Soccer',side);
        document.querySelector('.whiteboard-playoff').style.setProperty('--wb-durham-logo-scale','1.2');
      },side);
      const geometry = await page.locator('.wb-magnet:not(.wb-placeholder)').evaluateAll(cards=>cards.map(card=>({width:card.offsetWidth,height:card.offsetHeight,scale:new DOMMatrix(getComputedStyle(card.querySelector('.wb-logo')).transform).a,special:card.classList.contains('wb-durham-charter')})));
      assert.equal(geometry.find(c=>c.special).scale,1.2);
      assert.equal(geometry.find(c=>!c.special).scale,1);
      assert.equal(new Set(geometry.map(c=>c.width)).size,1);
      assert.equal(new Set(geometry.map(c=>c.height)).size,1);
      const layers = await page.locator('.wb-magnet:not(.wb-placeholder)').evaluateAll(cards=>cards.map(card=>({top:Number(getComputedStyle(card.querySelector('.wb-top')).zIndex),stats:Number(getComputedStyle(card.querySelector('.wb-stats')).zIndex)})));
      assert.ok(layers.every(layer=>layer.stats>layer.top),'Stat strips must cover enlarged logos in the top stacking context');
      for(const stroke of [3,0,2]) {
        await page.locator('.whiteboard-playoff').evaluate((board,value)=>board.style.setProperty('--wb-logo-stroke',value+'px'),stroke);
        await page.waitForFunction(value=>document.querySelector('.wb-surface feMorphology').getAttribute('radius')===String(value),stroke);
      }
    }
    console.log('Durham logo scales 20% in both regions, survives display renaming, and leaves other logos/card sizes unchanged.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
