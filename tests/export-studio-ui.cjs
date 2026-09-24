const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();
  const source=fs.readFileSync('playoff_board.js','utf8');
  await page.route('**/playoff_board.js*',route=>route.fulfill({contentType:'text/javascript',body:source.replace('function makeExportPreviewCard_(', 'window.studioTest={makeExportPreviewCard_,openExportPreview_,setExportCardProgress_}; function makeExportPreviewCard_(')}));
  await page.goto('http://localhost:8124/playoff_board.html');
  await page.waitForFunction(()=>window.studioTest);
  await page.evaluate(()=>{
   window.studioTest.openExportPreview_();
   const grid=document.querySelector('#exportPreviewGrid');
   for(let i=0;i<16;i++){
    const label=`${Math.floor(i/2)+1}A Football ${i%2?'Playoff Picture':'Region Standings'}`;
    grid.insertAdjacentHTML('beforeend',window.studioTest.makeExportPreviewCard_({key:String(i)},label,`${String(i+1).padStart(2,'0')} ${label}`));
    window.studioTest.setExportCardProgress_(String(i),'Ready','ready');
   }
   document.querySelector('#exportPreviewStatus').textContent='Ready. Showing 16 exports.';
  });
  assert.equal(await page.locator('#exportRenderCount').textContent(),'16 / 16 rendered');
  assert.equal(await page.locator('#downloadAllExportsBtn').isEnabled(),true);
  await page.evaluate(()=>window.studioTest.setExportCardProgress_('0','Rendering','loading'));
  assert.equal(await page.locator('#downloadAllExportsBtn').isDisabled(),true);
  assert.equal(await page.locator('#exportRenderCount').textContent(),'15 / 16 rendered');
  await page.evaluate(()=>window.studioTest.setExportCardProgress_('0','Error','error'));
  assert.equal(await page.locator('#downloadAllExportsBtn').isDisabled(),true);
  await page.evaluate(()=>window.studioTest.setExportCardProgress_('0','Ready','ready'));
  for(const width of [1294,390]){
   await page.setViewportSize({width,height:width===390?844:958});
   await page.screenshot({path:`style-previews/export-studio-${width}.png`});
   const result=await page.locator('.export-preview-panel').evaluate(panel=>({width:panel.clientWidth,scroll:panel.scrollWidth,queue:panel.querySelector('.export-preview-grid').clientHeight}));
   assert.ok(result.scroll<=result.width+1,JSON.stringify(result));assert.ok(result.queue>100);
   assert.ok((await page.locator('.export-preview-card').first().boundingBox()).height < 160);
   await page.locator('#exportPreviewClassMenuBtn').click();
   assert.equal(await page.locator('#exportPreviewClassMenu').isVisible(),true);
   await page.locator('#exportPreviewClassMenuBtn').click();
  }
  console.log('Desktop/mobile queue, overflow, and class menu checks passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
