const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:1600,height:1100}});
    const source=fs.readFileSync('playoff_board.js','utf8');
    await page.route('**/playoff_board.js*',r=>r.fulfill({contentType:'text/javascript',body:source.replace('function buildLiveFullBracketPayload_(',`window.polishTest={renderFullBracket_,buildLiveFullBracketPayload_,setViewMode_,noDecoration:()=>{decorateFullBracketTeams_=async()=>{};}}; function buildLiveFullBracketPayload_(`)}));
    await page.goto('http://localhost:8124/playoff_board.html');
    await page.waitForFunction(()=>window.polishTest);
    const response=await fetch('http://localhost:8124/full-bracket?sport=Football&classification=Class%203A&seasonYear=2025');
    const archive=await response.json();
    assert.ok(archive.html);
    for(const mode of ['archive','live']) {
      await page.evaluate(async({mode,archive})=>{
        const api=window.polishTest; api.noDecoration(); api.setViewMode_('full-bracket');
        const rows=side=>Array.from({length:24},(_,i)=>({school:i===3?'Bonnie Cone Leadership Academy':`${side} School ${i+1}`,mascot:'Wildcats',regionRank:i+1,record:'3-1-0',mapLogoUrl:'/NCHSAALOGO.png'}));
        const payload=mode==='archive'?archive:api.buildLiveFullBracketPayload_({west:rows('West'),east:rows('East'),total:48,excludedTeams:[]},'Class 3A');
        await api.renderFullBracket_(payload,'Class 3A','Football');
      },{mode,archive});
      await page.waitForTimeout(2200);
      for(const width of [1600,390]) {
        await page.setViewportSize({width,height:1100});
        await page.locator('[data-zoom="reset"]').click();
        await page.waitForTimeout(500);
        const metrics=await page.evaluate(()=>{
          const teams=[...document.querySelectorAll('.bracket-host .team')];
          return {count:teams.length,overflow:teams.filter(team=>team.getBoundingClientRect().width>team.closest('.matchup').getBoundingClientRect().width+1).length,
            heights:[...new Set(teams.map(team=>getComputedStyle(team).height))],pageOverflow:document.documentElement.scrollWidth>innerWidth+2};
        });
        assert.ok(metrics.count>0);
        assert.equal(metrics.overflow,0,JSON.stringify({mode,width,metrics}));
        assert.ok(metrics.heights.every(height=>Math.abs(parseFloat(height)-68)<.05));
        assert.equal(metrics.pageOverflow,false);
        await page.locator('.bracket-shell').scrollIntoViewIfNeeded();
        await page.screenshot({path:`style-previews/polish-${mode}-${width}.png`});
        console.log(mode,width,metrics);
      }
      await page.setViewportSize({width:1600,height:1100});
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
