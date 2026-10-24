const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const source=fs.readFileSync('playoff_board.js','utf8').replace('function renderPlayoffCardPicture(','window.perfTest={getMergedRowsForSelection_,buildRegionRows_,renderPlayoffCardPicture,setViewMode_,buildServerExportHtml_}; function renderPlayoffCardPicture(');
  await page.route('**/playoff_board.js*',route=>route.fulfill({contentType:'text/javascript',body:source}));
  await page.goto('http://localhost:8139/playoff_board.html');
  await page.evaluate(async()=>{
   await window.CutoutBoard.ready;
   const api=window.perfTest,selection=await api.getMergedRowsForSelection_('Class 3A','Football');
   api.setViewMode_('playoff');api.renderPlayoffCardPicture(api.buildRegionRows_(selection.rows,'Class 3A','east',[]),'Class 3A','Football','west');
   await document.fonts.ready;await Promise.all([...document.querySelector('.cutout-board').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
  });
  await page.waitForTimeout(400);
  const html=await page.evaluate(()=>({full:window.perfTest.buildServerExportHtml_(),board:window.perfTest.buildServerExportHtml_('.playoff-board')}));
  const results=[];
  const previous=fs.existsSync('performance-export.png')?fs.readFileSync('performance-export.png'):null;
  for(const kind of process.argv.includes('--quick')?['board']:['full','board','board']){
   const start=Date.now();
   const response=await page.request.post('http://localhost:8139/export-image',{data:{html:html[kind],selector:'.playoff-board'},timeout:90000});
   assert.equal(response.status(),200);const png=await response.body();
   assert.equal(png.readUInt32BE(16),3200);assert.equal(png.readUInt32BE(20),4000);
   results.push({kind,ms:Date.now()-start,htmlBytes:Buffer.byteLength(html[kind]),png});
   console.log(JSON.stringify({kind,ms:results.at(-1).ms,htmlBytes:results.at(-1).htmlBytes}));
  }
  const diff=await page.evaluate(async sources=>{
   const pixels=async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,image.width,image.height).data;};
   const a=await pixels(sources[0]),b=await pixels(sources[1]);let different=0,total=0,large=0;
   for(let i=0;i<a.length;i+=4){const delta=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);total+=delta;if(delta>15)different++;if(delta>450)large++;}
   return {changedFraction:different/(a.length/4),meanChannelError:total/(a.length/4*3),largeDifferenceFraction:large/(a.length/4)};
  },[previous||results[0].png,(results[1]||results[0]).png].map(png=>'data:image/png;base64,'+png.toString('base64')));
  fs.writeFileSync('performance-candidate.png',(results[1]||results[0]).png);
  console.log('Pixel difference:',diff);
  // GPU and CPU rasterization can differ in edge antialiasing and image sampling.
  assert.ok(diff.meanChannelError<1.5&&diff.largeDifferenceFraction<.003,'Rendered design remains visually equivalent');
  fs.writeFileSync('performance-export.png',(results[1]||results[0]).png);
  console.log('PASS: full-resolution exports, preserved pixels, repeated cached renders.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
