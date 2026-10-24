const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch();
 try{
  for(const offset of [0,650]){
   const html=`<html><body style="margin:0"><div style="height:${offset}px"></div><div class="sports-graphic" style="position:relative;width:1600px;height:2000px;background:#008000"><div style="position:absolute;left:0;right:0;bottom:0;height:500px;background:#0000ff"></div></div></body></html>`;
   const response=await fetch('http://localhost:8139/export-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({html,selector:'.sports-graphic'})});
   assert.equal(response.status,200);
   const png=Buffer.from(await response.arrayBuffer());
   console.log(`offset=${offset}: ${png.readUInt32BE(16)} x ${png.readUInt32BE(20)}`);
   assert.equal(png.readUInt32BE(16),3200);assert.equal(png.readUInt32BE(20),4000);
   const page=await browser.newPage();
   const bottom=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(1600,3990,1,1).data];},'data:image/png;base64,'+png.toString('base64'));
   assert.deepEqual(bottom,[0,0,255,255]);await page.close();
   fs.writeFileSync('export-canvas-'+offset+'.png',png);
  }
  console.log('PASS: full 3200x4000 canvas and bottom edge captured, including a board below the app header.');
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const source=fs.readFileSync('playoff_board.js','utf8').replace('function renderPlayoffCardPicture(','window.canvasTest={getMergedRowsForSelection_,buildRegionRows_,renderPlayoffCardPicture,setViewMode_,buildServerExportHtml_}; function renderPlayoffCardPicture(');
  await page.route('**/playoff_board.js*',route=>route.fulfill({contentType:'text/javascript',body:source}));
  await page.goto('http://localhost:8139/playoff_board.html');
  for(const side of ['west','east']){
   await page.evaluate(async side=>{
    await window.CutoutBoard.ready;
    const api=window.canvasTest,selection=await api.getMergedRowsForSelection_('Class 3A','Football');
    const regions=api.buildRegionRows_(selection.rows,'Class 3A','east',selection.rpiResult.excludedTeams||[]);
    api.setViewMode_('playoff');api.renderPlayoffCardPicture(regions,'Class 3A','Football',side);
    await document.fonts.ready;await Promise.all([...document.querySelector('.cutout-board').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
   },side);
   await page.waitForTimeout(300);
   const html=await page.evaluate(()=>window.canvasTest.buildServerExportHtml_());
   const response=await page.request.post('http://localhost:8139/export-image',{data:{html,selector:'.playoff-board'},timeout:90000});
   assert.equal(response.status(),200,await response.text().then(text=>text.slice(0,200)));
   const png=await response.body();assert.equal(png.readUInt32BE(16),3200);assert.equal(png.readUInt32BE(20),4000);
   fs.writeFileSync('full-whiteboard-'+side+'.png',png);
  }
  await page.close();console.log('PASS: actual 3A East/West official snapshots export at 3200x4000.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
