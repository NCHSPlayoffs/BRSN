const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const design=JSON.parse(fs.readFileSync('data/whiteboard-design.json','utf8'));
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext();
  await context.addInitScript(design=>{
   localStorage.setItem('brsn-cutout-layout-tuning','1');
   localStorage.setItem('brsn-cutout-magnet-v2',JSON.stringify({...design.card,textFitRevision:1,numericFitRevision:1,mascotFitRevision:1,rankLabelFitRevision:1}));
   localStorage.setItem('brsn-cutout-board-layout-v1',JSON.stringify(design.layout));
   localStorage.setItem('brsn-cutout-board-stats-v1',JSON.stringify({...design.stats,uprightFontRevision:1}));
  },design);
  const source=fs.readFileSync('playoff_board.js','utf8').replace('function withCardGhostTeams_(data, classification, sport) {','function withCardGhostTeams_(data, classification, sport) { return data;').replace('function renderPlayoffCardPicture(','window.refineTest={renderPlayoffCardPicture,setViewMode_}; function renderPlayoffCardPicture(');
  await context.route('**/playoff_board.js*',route=>route.fulfill({contentType:'text/javascript',body:source}));
  await context.route('**/design-settings',route=>route.fulfill({json:design}));
  await context.route('https://**',route=>route.fulfill({json:{}}));
  await context.route('**/lab-config.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
  const pages=[];
  for(const url of ['http://localhost:8125/board.html','http://localhost:8139/playoff_board.html']){
   const page=await context.newPage();await page.goto(url);await page.waitForTimeout(2500);
   await page.evaluate(async()=>{
    await window.CutoutBoard?.ready;
    const rows=Array.from({length:12},(_,i)=>({school:i===0?'Triton':'Test Team '+i,regionRank:i+1,rank:i+1,record:i===0?'14-13-0':i===1?'11-4-10':'3-1-0',rpi:'.55000',dominantHex:'#008040',secondaryHex:'#f0b040',mapLogoUrl:'/assets/fallback-logo.png',mascot:'Teams'}));
    window.refineTest.renderPlayoffCardPicture({east:rows,west:rows,total:24,excludedTeams:[]},'Class 8A','Football','west');
    await document.fonts.ready;await Promise.all([...document.querySelectorAll('.cutout-board img')].map(n=>n.decode().catch(()=>{})));
   });
   await page.waitForTimeout(500);pages.push(page);
  }
  const metrics=page=>page.evaluate(()=>[...document.querySelectorAll('.wb-magnet')].map(slot=>{
   const card=slot.querySelector('.magnet');
   return {top:parseFloat(getComputedStyle(slot).top),left:parseFloat(getComputedStyle(slot).left),width:card?.offsetWidth,height:card?.offsetHeight,logo:card?.style.getPropertyValue('--visible-logo-height'),label:card?.querySelector('.cm-stat-label')?.style.fontSize};
  }));
  const labMetrics=await metrics(pages[0]),officialMetrics=await metrics(pages[1]);
  labMetrics.forEach((item,index)=>{assert.ok(Math.abs(parseFloat(item.label)-parseFloat(officialMetrics[index].label))<=1);});
  assert.deepEqual(labMetrics.map(({label,...geometry})=>geometry),officialMetrics.map(({label,...geometry})=>geometry));
  for(const page of pages){
   assert.equal(await page.locator('.cm-record').first().textContent(),'14-13');
   assert.equal(await page.locator('.cm-record').nth(3).textContent(),'11-4-10');
   const sizing=await page.locator('.cm-record').nth(3).evaluate(n=>({
    record:parseFloat(getComputedStyle(n).fontSize),
    rpi:parseFloat(getComputedStyle(n.parentElement.nextElementSibling.querySelector('.cm-stat-value')).fontSize),
    fits:n.querySelector('.cm-ink-frame').offsetWidth<=n.clientWidth+1
   }));
   assert.ok(sizing.record>=sizing.rpi*.85);
   assert.ok(sizing.fits);
   assert.equal(await page.locator('.cm-record').first().evaluate(n=>n.previousElementSibling.textContent),'W-L-T');
   assert.equal(await page.locator('.cm-record').nth(3).evaluate(n=>n.previousElementSibling.textContent),'W-L-T');
  }
  const lab=pages[0];
  await lab.locator('summary').filter({hasText:'Card Alignment'}).click();
  const tiedValue=lab.locator('.cm-record').nth(3);
  const originalRecordFont=await tiedValue.evaluate(n=>getComputedStyle(n).fontSize);
  await lab.locator('#lab-control-recordValueX').fill('80');
  await lab.locator('#lab-control-recordValueX').dispatchEvent('input');
  await lab.locator('#lab-control-recordValueX').dispatchEvent('change');
  await lab.waitForTimeout(200);
  const tiedOverflow=await tiedValue.evaluate(n=>{
   const frame=n.querySelector('.cm-ink-frame'),manualX=new DOMMatrixReadOnly(getComputedStyle(n).transform).m41,shift=new DOMMatrixReadOnly(getComputedStyle(frame).transform).m41;
   return {font:getComputedStyle(n).fontSize,shift,right:frame.offsetLeft+frame.offsetWidth+manualX+shift,width:n.clientWidth};
  });
  assert.equal(tiedOverflow.font,originalRecordFont);
  assert.ok(tiedOverflow.shift<0);
  assert.ok(tiedOverflow.right<=tiedOverflow.width);
  assert.equal(await lab.locator('.cm-record').first().locator('.cm-ink-frame').evaluate(n=>n.style.transform),'');
  await lab.click('#lab-undo');await lab.waitForTimeout(150);
  const before=await lab.locator('.wb-first-home').first().evaluate(n=>parseFloat(getComputedStyle(n).top));
  await lab.locator('#lab-control-homeY').fill('20');await lab.locator('#lab-control-homeY').dispatchEvent('input');await lab.waitForTimeout(200);
  assert.equal(await lab.locator('.wb-first-home').first().evaluate(n=>parseFloat(getComputedStyle(n).top)),before+20);
  await lab.click('#lab-undo');
  await lab.locator('#lab-control-schoolStrokeColor').check();await lab.waitForTimeout(200);
  assert.equal(await lab.locator('.cm-school').first().evaluate(n=>getComputedStyle(n).webkitTextStrokeColor),'rgb(240, 176, 64)');
  await lab.click('#lab-undo');assert.equal(await lab.locator('#lab-control-schoolStrokeColor').isChecked(),false);
  assert.equal(await lab.locator('[data-control-group="Bracket Connectors"] input[type=number]').count(),4);
  await lab.locator('[data-control-group="Bracket Connectors"] summary').click();
  await lab.locator('#lab-control-connectorLineLength').fill('-150');
  await lab.locator('#lab-control-connectorLineLength').dispatchEvent('input');
  await lab.waitForTimeout(100);
  assert.equal(await lab.locator('.cutout-board').evaluate(n=>n.style.getPropertyValue('--lab-connector-line-length')),'-150px');
  assert.match(await lab.locator('.wb-title').evaluate(n=>getComputedStyle(n).backgroundImage),/linear-gradient/);
  assert.equal(await lab.locator('.wb-title').evaluate(n=>getComputedStyle(n).webkitTextFillColor),'rgba(0, 0, 0, 0)');
  let magnetInk=await lab.locator('.cm-number-ink').first().evaluate(n=>getComputedStyle(n).backgroundImage);
  await lab.locator('[data-control-group="Fonts"] summary').click();
  const rankInk=lab.locator('.cm-rankbox:not(.cm-move) .cm-number-ink').first();
  await lab.locator('#lab-control-inkStrength').fill('0');await lab.locator('#lab-control-inkStrength').dispatchEvent('input');await lab.waitForTimeout(150);
  const rankSolid=await rankInk.evaluate(n=>({background:getComputedStyle(n).backgroundImage,fill:getComputedStyle(n).webkitTextFillColor}));
  const rankZeroImage=await rankInk.screenshot({path:'rank-ink-zero.png'});
  await lab.locator('#lab-control-inkStrength').fill('100');await lab.locator('#lab-control-inkStrength').dispatchEvent('input');await lab.waitForTimeout(150);
  const rankStrong=await rankInk.evaluate(n=>({background:getComputedStyle(n).backgroundImage,fill:getComputedStyle(n).webkitTextFillColor}));
  assert.notEqual(rankSolid.background,rankStrong.background);
  assert.equal(rankStrong.fill,'rgba(0, 0, 0, 0)');
  assert.match(await rankInk.evaluate(n=>getComputedStyle(n).backgroundSize),/px/);
  const rankStrongImage=await rankInk.screenshot({path:'rank-ink-strong.png'});
  const changedRankPixels=await lab.evaluate(async images=>{
   const decode=async src=>{const image=new Image();image.src=src;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);return context.getImageData(0,0,image.width,image.height).data;};
   const [a,b]=await Promise.all(images.map(decode));let changed=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)changed++;return changed;
  },[rankZeroImage,rankStrongImage].map(buffer=>'data:image/png;base64,'+buffer.toString('base64')));
  assert.ok(changedRankPixels>0,'Rank ink strength must visibly change rendered pixels');
  magnetInk=await lab.locator('.cm-number-ink').first().evaluate(n=>getComputedStyle(n).backgroundImage);
  await lab.locator('#lab-control-headerInkStrength').fill('0');
  await lab.locator('#lab-control-headerInkStrength').dispatchEvent('input');
  await lab.waitForTimeout(100);
  assert.equal(await lab.locator('.cutout-board').evaluate(n=>n.style.getPropertyValue('--lab-header-ink-dark')),'0%');
  assert.equal(await lab.locator('.cm-number-ink').first().evaluate(n=>getComputedStyle(n).backgroundImage),magnetInk);
  await lab.locator('[data-control-group="Card Design"] summary').click();
  const logoReflection=lab.locator('.cm-logo-reflection').first();
  const originalReflectionOpacity=await logoReflection.evaluate(n=>getComputedStyle(n).opacity);
  assert.notEqual(await logoReflection.evaluate(n=>getComputedStyle(n).maskImage),'none');
  assert.match(await lab.locator('.cm-scoreboard').first().evaluate(n=>getComputedStyle(n,'::after').backgroundImage),/linear-gradient/);
  await lab.locator('#lab-control-reflectionStrength').fill('0');
  await lab.locator('#lab-control-reflectionStrength').dispatchEvent('input');
  await lab.locator('#lab-control-reflectionStrength').dispatchEvent('change');
  await lab.waitForTimeout(100);
  assert.equal(await logoReflection.evaluate(n=>getComputedStyle(n).opacity),'0');
  assert.equal(await lab.locator('.cm-scoreboard').first().evaluate(n=>getComputedStyle(n,'::after').opacity),'0');
  await lab.click('#lab-undo');await lab.waitForTimeout(100);
  assert.equal(await logoReflection.evaluate(n=>getComputedStyle(n).opacity),originalReflectionOpacity);
  assert.equal(await lab.evaluate(()=>CutoutCard.mascotColor('#000000','#404040',0,4,0,0)),'#404040');
  assert.equal(await lab.evaluate(()=>CutoutCard.mascotColor('#000000','#404040',0,4,100,0)),'#ffffff');
  assert.equal(await lab.evaluate(()=>CutoutCard.mascotColor('#000000','#f0b040',0,4,100,0)),'#f0b040');
  await pages[1].locator('.cutout-board').screenshot({path:'design-refinements.png'});
  await pages[1].evaluate(()=>{
   const row={school:'Test Team',regionRank:1,rank:1,record:'3-1-0',rpi:'.55000',dominantHex:'#008040',mapLogoUrl:'/assets/fallback-logo.png',mascot:'Teams'};
   window.refineTest.renderPlayoffCardPicture({east:[row],west:[row],total:2,excludedTeams:[]},'Class 8A','Football','west');
  });
  await pages[1].waitForTimeout(300);
  assert.ok(await pages[1].locator('.cutout-placeholder').count()>0);
  assert.equal(await pages[1].locator('.cutout-placeholder').first().evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(250, 250, 248)');
  assert.equal(await pages[1].locator('.cutout-placeholder[data-kind=bye] .placeholder-detail').first().textContent(),'[NO OPPONENT]');
  assert.equal(await pages[1].locator('.cutout-placeholder').first().evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(229, 27, 35)');
  await pages[1].locator('.cutout-placeholder[data-kind=bye]').first().screenshot({path:'placeholder-bye-west.png'});
  const originalRim=design.card.rim,originalDepth=design.card.depth;
  const placeholder=pages[1].locator('.cutout-placeholder[data-kind=bye]').first();
  const originalPlaceholderRim=await placeholder.evaluate(n=>parseFloat(n.style.getPropertyValue('--placeholder-rim')));
  design.card.rim=30;design.card.depth=12;design.savedAt='placeholder-rim-test';
  await pages[1].evaluate(()=>CutoutBoard.refreshDesign());await pages[1].waitForTimeout(100);
  assert.ok(await placeholder.evaluate(n=>parseFloat(n.style.getPropertyValue('--placeholder-rim')))>originalPlaceholderRim);
  assert.ok(await placeholder.evaluate(n=>getComputedStyle(n).boxShadow.includes('rgb(255, 255, 255)')));
  design.card.rim=originalRim;design.card.depth=originalDepth;design.savedAt='placeholder-rim-restored';
  await pages[1].evaluate(()=>CutoutBoard.refreshDesign());
  await pages[1].evaluate(()=>{
   const row=i=>({school:'Test Team '+i,regionRank:i+9,rank:i+9,record:'3-1-0',rpi:'.55000',dominantHex:'#008040',mapLogoUrl:'/assets/fallback-logo.png',mascot:'Teams'});
   const rows=Array.from({length:16},(_,i)=>row(i));
   window.refineTest.renderPlayoffCardPicture({east:rows,west:rows,total:48,excludedTeams:[]},'Class 3A','Football','east');
  });
  await pages[1].waitForTimeout(300);
  assert.equal(await pages[1].locator('.cutout-placeholder').first().evaluate(n=>getComputedStyle(n).borderTopColor),'rgb(8, 127, 232)');
  assert.ok(await pages[1].locator('.cutout-placeholder .placeholder-title').first().evaluate(n=>n.scrollWidth<=n.clientWidth+1));
  await pages[1].locator('.cutout-placeholder').first().screenshot({path:'placeholder-matchup-east.png'});
  console.log('PASS: Lab/official geometry, Triton exception, labels, column Y, secondary stroke toggle/undo, threshold-only mascot adjustments.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
