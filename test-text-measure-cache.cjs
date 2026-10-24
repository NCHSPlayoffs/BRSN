const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100}});
  const design=JSON.parse(fs.readFileSync('data/whiteboard-design.json','utf8'));
  const core=fs.readFileSync('playoff_board.js','utf8').replace('function renderPlayoffCardPicture(','window.measureTest={renderPlayoffCardPicture}; function renderPlayoffCardPicture(');
  const optimized=fs.readFileSync('cutout-board.js','utf8');
  const baseline=optimized.replace('if(!measurements.has(key))measurements.set(key,context.measureText(value));','measurements.set(key,context.measureText(value));');
  const results=[];
  for(const source of [baseline,optimized]){
   const page=await context.newPage();
   await page.addInitScript(()=>{
    const original=CanvasRenderingContext2D.prototype.measureText;
    window.measureCalls=0;
    CanvasRenderingContext2D.prototype.measureText=function(...args){window.measureCalls++;return original.apply(this,args);};
   });
   await page.route('https://**',r=>r.fulfill({json:{}}));
   await page.route('**/design-settings',r=>r.fulfill({json:design}));
   await page.route('**/playoff_board.js*',r=>r.fulfill({contentType:'text/javascript',body:core}));
   await page.route('**/cutout-board.js*',r=>r.fulfill({contentType:'text/javascript',body:source}));
   await page.goto('http://localhost:8139/playoff_board.html');
   await page.evaluate(async()=>{
    await window.CutoutBoard.ready;
    const rows=Array.from({length:24},(_,i)=>({school:['East Rutherford','Hendersonville','North Stanly','Mountain Heritage','Shelby','TC Roberson'][i%6],regionRank:i+1,rank:i+1,record:'11-4-10',rpi:'.55000',dominantHex:'#008040',secondaryHex:'#f0b040',mapLogoUrl:'/assets/cutout-team-'+i+'.png',mascot:'Teams'}));
    window.measureTest.renderPlayoffCardPicture({east:rows,west:rows,total:48,excludedTeams:[]},'Class 3A','Football','west');
    await Promise.all([...document.querySelectorAll('.cutout-board img')].map(n=>n.decode().catch(()=>{})));await document.fonts.ready;
   });
   await page.waitForTimeout(600);
   await page.evaluate(()=>{window.measureCalls=0;document.querySelector('.cutout-board')._cutoutRefresh();});
   await page.waitForTimeout(400);
   const result=await page.evaluate(()=>({calls:window.measureCalls,metrics:[...document.querySelectorAll('.cm-school,.cm-stat-label,.cm-stat-value,.cm-rank-value')].map(n=>[n.textContent,n.style.cssText,n.offsetWidth,n.offsetHeight])}));
   result.image=await page.locator('.cutout-board').screenshot();
   results.push(result);await page.close();
  }
  assert.deepEqual(results[1].metrics,results[0].metrics);
  assert.ok(results[1].image.equals(results[0].image),'Measurement caching must preserve every rendered pixel');
  assert.ok(results[1].calls<results[0].calls*.7,'Caching must substantially reduce real canvas measurements');
  console.log(JSON.stringify({baselineCalls:results[0].calls,optimizedCalls:results[1].calls,reduction:Math.round((1-results[1].calls/results[0].calls)*100)+'%',pixels:'identical'}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
