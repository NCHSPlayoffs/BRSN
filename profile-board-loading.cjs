const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();
  const source=fs.readFileSync('playoff_board.js','utf8')+'\nwindow.loadingProfile={getMergedRowsForSelection_};';
  await page.route('**/playoff_board.js*',r=>r.fulfill({contentType:'text/javascript',body:source}));
  const starts=new Map();
  page.on('request',r=>{if(r.resourceType()==='fetch')starts.set(r,Date.now());});
  page.on('requestfinished',r=>{if(starts.has(r))console.log(Date.now()-starts.get(r)+'ms '+r.method()+' '+r.url());});
  await page.goto('http://localhost:8139/playoff_board.html');
  for(const regionalHistory of [false,true,true]){
   const start=Date.now();
   const result=await page.evaluate(async regionalHistory=>{
    const result=await window.loadingProfile.getMergedRowsForSelection_('Class 3A','Football',undefined,{regionalHistory});
    return {rows:result.rows.length,source:result.rpiResult.source,error:result.rpiResult.changeCompareError};
   },regionalHistory);
   console.log(JSON.stringify({regionalHistory,ms:Date.now()-start,...result}));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
