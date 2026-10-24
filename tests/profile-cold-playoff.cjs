const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch();
 try {
 const page=await browser.newPage();
 page.on('console',m=>{if(m.text().startsWith('PROFILE')) console.log(m.text());});
 page.on('pageerror',e=>console.log('ERROR',e.message));
 const source=fs.readFileSync('playoff_board.js','utf8');
 const names=['getMergedRowsForCurrentSelection_','fetchRpiRows_','getTeamDetailsMapCached_','loadAdminConfig_','addLiveRpiChangeData_','addRegionalRankHistory_','fetchRegionalLastRows_','addComparisonGameResults_'];
 const instrument=names.map(name=>`{const original=${name};${name}=async function(...args){const start=performance.now();try{return await original.apply(this,args);}finally{console.log('PROFILE ${name} '+Math.round(performance.now()-start)+'ms');}};}`).join('\n');
 await page.route('**/playoff_board.js*',r=>r.fulfill({contentType:'text/javascript',body:source+'\n'+instrument}));
 await page.goto('http://localhost:8124/playoff_board.html');
 const start=Date.now();
 await page.locator('#playoffCardEastTestBtn').click();
 await page.waitForFunction(()=>document.querySelector('.card-playoff-board')||document.querySelector('#statusText').textContent.includes('Unable'),null,{timeout:120000});
 console.log('PROFILE visible '+(Date.now()-start)+'ms');
 console.log(await page.locator('#statusText').textContent());
 await page.waitForTimeout(1500);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
