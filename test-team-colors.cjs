const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {chromium}=require('playwright');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('cutout-card.js','utf8'),sandbox);
const colors=sandbox.window.CutoutCard;
assert.equal(colors.panelColor('#29AF44',0,0),'#29af44');
assert.equal(colors.panelColor('#ffffff',0,20),'#cccccc');
(async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/design-settings',route=>route.fulfill({json:null}));
  const source=fs.readFileSync('playoff_board.js','utf8').replace('function renderPlayoffCardPicture(','window.colorTest={getMergedRowsForSelection_,renderPlayoffCardPicture,setViewMode_}; function renderPlayoffCardPicture(');
  await page.route('**/playoff_board.js*',route=>route.fulfill({contentType:'text/javascript',body:source}));
  await page.goto('http://localhost:8139/playoff_board.html');
  const live=await page.evaluate(async()=>{
   const selection=await window.colorTest.getMergedRowsForSelection_('Class 1A','Football');
   return selection.rows.filter(row=>/collegiate|columbia/i.test(row.school)).map(row=>({school:row.school,primary:row.dominantHex,original:row.originalSchool}));
  });
  console.log('Live sheet color merge:',JSON.stringify(live));
  const se=live.find(row=>/collegiate/i.test(row.school));assert.ok(se);assert.equal(se.primary.toUpperCase(),'#29AF44');
  await page.evaluate(async()=>{
   await window.CutoutBoard.ready;window.colorTest.setViewMode_('playoff');
   const rows=[{school:'SE Collegiate',dominantHex:'#29AF44'},{school:'Columbia',dominantHex:'#ffff00'}].map((row,i)=>({...row,regionRank:i+1,rank:i+1,record:'2-1-0',rpi:'.55000',mapLogoUrl:'/assets/fallback-logo.png',mascot:'Teams'}));
   window.colorTest.renderPlayoffCardPicture({west:rows,east:rows,total:4,excludedTeams:[]},'Class 1A','Football','west');
   document.querySelector('.cutout-board').style.setProperty('--lab-panel-lighten','0%');document.querySelector('.cutout-board')._cutoutRefresh();
  });
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.magnet').first().evaluate(n=>n.style.getPropertyValue('--panel-color')),'#29af44');
  assert.ok(await page.locator('.cm-school').evaluateAll(nodes=>nodes.every(n=>{const css=getComputedStyle(n);return css.color==='rgb(255, 255, 255)'&&css.webkitTextStrokeColor==='rgb(0, 0, 0)'&&css.webkitTextStrokeWidth==='2.5px';})));
  await page.locator('.cutout-board').screenshot({path:'team-colors-fixed.png'});
  await page.goto('http://localhost:8125/board.html');
  await page.waitForFunction(()=>document.querySelector('.cutout-board'));
  assert.deepEqual(await page.locator('.lab-controls>details>summary').allTextContents(),['Team Colors','Fonts','Card Alignment','Card Design','Individual Teams']);
  for(const id of ['lighten','darken','mascotContrast','secondaryLightening'])assert.equal(await page.locator('#lab-control-'+id).evaluate(n=>n.closest('details').dataset.controlGroup),'Team Colors');
  for(const id of ['school','rank','stat','rpiSpacing','valuesFont','changeFont'])assert.equal(await page.locator('#lab-control-'+id).evaluate(n=>n.closest('details').dataset.controlGroup),'Fonts');
  const ids=await page.locator('.lab-controls [id]').evaluateAll(nodes=>nodes.map(n=>n.id));assert.equal(new Set(ids).size,ids.length);
  await page.locator('#lab-control-darken').fill('20');await page.locator('#lab-control-darken').dispatchEvent('input');
  await page.waitForFunction(()=>document.querySelector('.cutout-board').style.getPropertyValue('--lab-panel-darken')==='20%');
  const before=await page.locator('.magnet').first().evaluate(n=>n.style.getPropertyValue('--panel-color'));
  await page.click('#lab-undo');
  await page.waitForFunction(()=>document.querySelector('.cutout-board').style.getPropertyValue('--lab-panel-darken')==='0%');
  assert.notEqual(await page.locator('.magnet').first().evaluate(n=>n.style.getPropertyValue('--panel-color')),before);
  await page.screenshot({path:'reorganized-controls.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: real renamed team retains sheet color, all names are white with black strokes, darkening works, five control groups, no duplicate control IDs.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
