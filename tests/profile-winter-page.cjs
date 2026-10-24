const {chromium} = require('playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    const source = fs.readFileSync('playoff_board.js','utf8');
    const names = ['getMergedRowsForCurrentSelection_','fetchRpiRows_','getTeamDetailsMapCached_','loadAdminConfig_','addLiveRpiChangeData_','requestRpiSnapshotCompare_','resolveCompareSnapshotId_','addRegionalRankHistory_'];
    const wrappers = names.map(name=>`{const original=${name};${name}=async function(...args){const start=performance.now();try{return await original.apply(this,args);}finally{console.log('PROFILE ${name} '+Math.round(performance.now()-start)+'ms');}};}`).join('\n');
    page.on('console', m=>{if(m.text().startsWith('PROFILE')) console.log(m.text());});
    await page.route('**/playoff_board.js*', route=>route.fulfill({contentType:'text/javascript',body:source+'\n'+wrappers}));
    const start = performance.now();
    await page.goto('http://localhost:8138/playoff_board.html');
    console.log('Fresh page DOM:',Math.round(performance.now()-start)+'ms');
    const load = performance.now();
    await page.locator('#playoffCardEastTestBtn').click();
    await page.waitForFunction(()=>document.querySelector('.whiteboard-playoff') || /Unable|failed/i.test(document.querySelector('#statusText')?.textContent || ''),null,{timeout:120000});
    console.log('First playoff board:',Math.round(performance.now()-load)+'ms');
    console.log(await page.locator('#statusText').textContent());
    if(errors.length) throw new Error(errors.join('\n'));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
