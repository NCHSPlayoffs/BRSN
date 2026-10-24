const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    const source=fs.readFileSync('playoff_board.js','utf8');
    await page.route('**/playoff_board.js*', route=>route.fulfill({contentType:'text/javascript',body:source.replace('function buildLiveFullBracketPayload_(', `window.liveTest={buildLiveFullBracketPayload_,renderFullBracket_,setViewMode_, mockData:()=>{
      window.archiveRequests=0;
      getMergedRowsForSelection_=async()=>({rows:Array.from({length:26},(_,i)=>({school:'School '+(i+1),rank:i+1,rpi:String(.9-i*.01),longitude:75+i*.1,mapLogoUrl:'/NCHSAALOGO.png'})),rpiResult:{}});
      requestFullBracketJson_=async()=>{window.archiveRequests++;return {html:'<p id="archive-fixture">Archived bracket</p>'};};
      decorateFullBracketTeams_=async()=>{};
    }}; function buildLiveFullBracketPayload_(`)}));
    await page.goto('http://localhost:8124/playoff_board.html');
    await page.waitForFunction(()=>window.liveTest);
    for(const count of [12,13,14,15,16,24]) {
      await page.evaluate(async count=>{
        const rows=side=>Array.from({length:count},(_,i)=>({school:`${side} School ${i+1}`,regionRank:i+1,record:'3-1-0',rpi:'.65432',mapLogoUrl:'/NCHSAALOGO.png',lineRegion:side}));
        const data={west:rows('West'),east:rows('East'),total:count*2,excludedTeams:[]};
        window.liveTest.setViewMode_('full-bracket');
        await window.liveTest.renderFullBracket_(window.liveTest.buildLiveFullBracketPayload_(data,'Class 3A'),'Class 3A','Football');
      }, count);
      assert.equal(await page.locator('.live-region').count(),2);
      assert.ok(await page.locator('.live-connectors path').count()>0);
      assert.equal(await page.locator('.live-championship .live-placeholder').count(),2);
      assert.ok(await page.locator('.live-game .game-number').evaluateAll(nodes=>nodes.every(node=>
        /^(West|East|State) - Game #\d+ - Round \d+$/.test(node.textContent) && node.scrollWidth <= node.clientWidth + 1)));
      const layout = await page.evaluate(() => {
        const west=document.querySelector('.live-west .live-game').getBoundingClientRect();
        const east=document.querySelector('.live-east .live-game').getBoundingClientRect();
        const finals=document.querySelector('.live-championship').getBoundingClientRect();
        return {west:west.x,east:east.x,wy:west.y,ey:east.y,final:finals.x};
      });
      assert.ok(layout.west < layout.final && layout.final < layout.east, JSON.stringify(layout));
      assert.equal(layout.wy,layout.ey,'Regions start at the same vertical position');
    }
    await page.locator('[data-zoom="in"]').click();
    assert.ok(Number(await page.locator('#zoomValue').inputValue())>100);
    await page.screenshot({path:'style-previews/live-bracket-desktop.png'});
    await page.evaluate(() => {
      const host=document.querySelector('#bracketViewport'), final=document.querySelector('.live-championship');
      host.scrollTop += final.getBoundingClientRect().top - host.getBoundingClientRect().top - 200;
    });
    await page.screenshot({path:'style-previews/live-bracket-finals.png'});
    await page.setViewportSize({width:390,height:844});
    await page.locator('.bracket-shell').scrollIntoViewIfNeeded();
    await page.screenshot({path:'style-previews/live-bracket-mobile.png'});
    await page.evaluate(()=>window.liveTest.mockData());
    await page.locator('#eastWestLineBtn').click();
    await page.waitForSelector('.live-region', {state:'attached'});
    await page.waitForFunction(()=>!document.querySelector('#eastWestLineBtn').disabled);
    assert.equal(await page.evaluate(()=>window.archiveRequests),0);
    await page.evaluate(()=>{
      const year=document.querySelector('#seasonYear');
      year.add(new Option('2025','2025'));
    });
    await page.waitForFunction(()=>document.querySelector('#bracketYear option[value="2025"]'));
    await page.selectOption('#bracketYear','2025');
    await page.waitForSelector('#archive-fixture');
    assert.equal(await page.evaluate(()=>window.archiveRequests),1);
    assert.deepEqual(errors,[]);
    console.log('Live bracket desktop/mobile render, 12-24 teams, zoom, and no script errors passed.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
