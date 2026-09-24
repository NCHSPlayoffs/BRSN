const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();
  const source=fs.readFileSync('playoff_board.js','utf8');
  await page.route('**/playoff_board.js*',r=>r.fulfill({contentType:'text/javascript',body:source.replace('function renderPlayoffPicture(','window.aspectTest={renderPlayoffPicture,renderRegionRows,buildServerExportHtml_}; function renderPlayoffPicture(')}));
  await page.goto('http://localhost:8124/playoff_board.html');await page.waitForFunction(()=>window.aspectTest);
  for(const count of [13,16,24])for(const kind of ['playoff','standings']){
   const html=await page.evaluate(({count,kind})=>{
    const rows=Array.from({length:count},(_,i)=>({school:i===10?'SE Collegiate Prep Academy':`School ${i+1}`,regionRank:i+1,record:'3-1-0',rpi:'.65432',logoUrl:'/NCHSAALOGO.png'}));
    const east=rows.map(r=>({...r}));east[count-1].isOddExtra=true;east[count-1].lineRegion='East';
    (kind==='playoff'?window.aspectTest.renderPlayoffPicture:window.aspectTest.renderRegionRows)({west:rows,east,total:count*2,excludedTeams:[]},'Class 3A','Football');
    return window.aspectTest.buildServerExportHtml_();
   },{count,kind});
   const preview=await browser.newPage({viewport:{width:1600,height:2100},deviceScaleFactor:2});
   await preview.setContent(html,{waitUntil:'networkidle'});await preview.evaluate(()=>document.fonts.ready);
   const metrics=await preview.locator('.sports-graphic').evaluate(board=>{
    const rect=board.getBoundingClientRect(),footer=board.querySelector('.graphic-footer').getBoundingClientRect();
    const content=board.querySelector('.playoff-regions,.region-split').getBoundingClientRect();
    return {height:rect.height,bottom:rect.bottom,footer:footer.bottom,content:content.bottom,footerTop:footer.top,notes:board.querySelectorAll('.odd-extra-note').length};
   });
   assert.equal(metrics.height,2000);assert.ok(metrics.footer<=metrics.bottom,JSON.stringify(metrics));assert.ok(metrics.content<=metrics.footerTop,JSON.stringify(metrics));assert.equal(metrics.notes,1);
   const png=await preview.locator('.sports-graphic').screenshot({path:`style-previews/${kind}-${count}-4x5.png`});
   assert.equal(png.readUInt32BE(16),3200);assert.equal(png.readUInt32BE(20),4000);
   if(count===24&&kind==='playoff'){
    const jpeg=await preview.locator('.sports-graphic').screenshot({type:'jpeg',quality:92,path:'style-previews/playoff-24-4x5.jpg'});
    console.log('Sample sizes:',{pngMB:(png.length/1048576).toFixed(2),jpgMB:(jpeg.length/1048576).toFixed(2)});
   }
   console.log(kind,count,metrics);await preview.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
