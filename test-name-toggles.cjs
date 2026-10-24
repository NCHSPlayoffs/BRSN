const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

(async()=>{
  const design=JSON.parse(fs.readFileSync('data/whiteboard-design.json','utf8'));
  const source=fs.readFileSync('playoff_board.js','utf8').replace('function withCardGhostTeams_(data, classification, sport) {','function withCardGhostTeams_(data, classification, sport) { return data;').replace('function renderPlayoffCardPicture(','window.nameTest={renderPlayoffCardPicture}; function renderPlayoffCardPicture(');
  const browser=await chromium.launch();
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1100}});
    await context.addInitScript(design=>{
      localStorage.setItem('brsn-cutout-layout-tuning','1');
      localStorage.setItem('brsn-cutout-magnet-v2',JSON.stringify({...design.card,textFitRevision:1,numericFitRevision:1,mascotFitRevision:1,rankLabelFitRevision:1}));
      localStorage.setItem('brsn-cutout-board-layout-v1',JSON.stringify(design.layout));
      localStorage.setItem('brsn-cutout-board-stats-v1',JSON.stringify({...design.stats,shortenTeamNames:0,centerTeamNames:0,uprightFontRevision:1}));
    },design);
    let saved=design;
    await context.route('**/design-settings',route=>{
      if(route.request().method()==='POST')saved=route.request().postDataJSON();
      return route.fulfill({json:route.request().method()==='POST'?{saved:true}:saved});
    });
    await context.route('https://**',route=>route.fulfill({json:{}}));
    await context.route('**/lab-config.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
    await context.route('**/playoff_board.js*',route=>route.fulfill({contentType:'text/javascript',body:source}));
    const render=async page=>{
      await page.evaluate(async()=>{
        await window.CutoutBoard?.ready;
        const names=['Rocky Mountain','Mt. Airy','Shelby','West Wilkes','SE Collegiate','Northwest Cabarrus','East Rutherford','Hendersonville','Pine Lake Prep','North Stanly','Mountain Heritage','East Davidson'];
        const logos={'Mt. Airy':9,Shelby:13,'West Wilkes':7,'East Rutherford':6,Hendersonville:1,'North Stanly':11,'Mountain Heritage':3,'East Davidson':10};
        const rows=Array.from({length:24},(_,i)=>({school:names[i%names.length],regionRank:i+1,rank:i+1,record:'6-1-0',rpi:'.55000',dominantHex:'#008040',secondaryHex:'#f0b040',mapLogoUrl:'/assets/cutout-team-'+(logos[names[i%names.length]]??i)+'.png',mascot:'Teams'}));
        window.nameTest.renderPlayoffCardPicture({east:rows,west:rows,total:48,excludedTeams:[]},'Class 3A','Football','west');
        await document.fonts.ready;
        await Promise.all([...document.querySelectorAll('.cutout-board img')].map(n=>n.decode().catch(()=>{})));
      });
      await page.waitForTimeout(600);
    };
    const page=await context.newPage();await page.goto('http://localhost:8125/board.html');await render(page);
    const names=()=>page.locator('.cm-school').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.fullName,n.innerHTML])));
    const before=await names();
    const initialBoundaryErrors=await page.locator('.cm-school').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().right>n.closest('.cm-face').querySelector('.cm-rankbox').getBoundingClientRect().left+1).map(n=>n.dataset.fullName));
    assert.deepEqual(initialBoundaryErrors,[],'Initial saved design must constrain name boxes before the rank column');
    await page.locator('.cm-school[data-full-name="East Rutherford"]').first().evaluate(n=>n.closest('.wb-magnet').setAttribute('data-name-test-preview','true'));
    await page.locator('[data-name-test-preview]').screenshot({path:'east-rutherford-font-fix.png'});
    const geometry=()=>page.locator('.magnet').evaluateAll(nodes=>nodes.map(n=>[n.offsetWidth,n.offsetHeight]));
    const dimensions=await geometry();
    const search=page.getByRole('searchbox',{name:'Search controls'});
    await search.fill('line break');
    await page.locator('#lab-control-shortenTeamNames').check();await page.waitForTimeout(250);
    const shortened=await names();
    assert.equal(shortened['Rocky Mountain'],'ROCKY<br>MOUNTAIN');assert.equal(shortened['West Wilkes'],'WEST<br>WILKES');
    assert.equal(shortened['Mt. Airy'],'MT. AIRY');assert.equal(shortened['SE Collegiate'],'SE COLLEGIATE');assert.equal(shortened.Shelby,'SHELBY');
    assert.deepEqual(await geometry(),dimensions);
    await page.click('#lab-undo');await page.waitForTimeout(250);
    const normalized=names=>Object.fromEntries(Object.entries(names).map(([name,html])=>[name,html.replace(/<br>/g,' ')]));
    assert.deepEqual(normalized(await names()),normalized(before));assert.equal(await page.locator('#lab-control-shortenTeamNames').isChecked(),false);
    await page.locator('#lab-control-shortenTeamNames').check();
    await search.fill('center team');await page.locator('#lab-control-centerTeamNames').check();await page.waitForTimeout(250);
    assert.equal(await page.locator('.cm-school').first().evaluate(n=>getComputedStyle(n).textAlign),'center');
    await page.click('#lab-undo');await page.waitForTimeout(250);
    assert.equal(await page.locator('.cm-school').first().evaluate(n=>getComputedStyle(n).textAlign),'left');
    assert.equal(await page.locator('#lab-control-centerTeamNames').isChecked(),false);
    await page.locator('#lab-control-centerTeamNames').check();
    await search.fill('mascot y');
    const mascot=page.locator('.cm-mascot').first();
    const metrics=()=>mascot.evaluate(n=>({
      translation:getComputedStyle(n).translate,
      font:getComputedStyle(n).fontSize,
      nameTop:n.previousElementSibling.getBoundingClientRect().top,
      lineBefore:getComputedStyle(n,'::before').height,
      lineAfter:getComputedStyle(n,'::after').height
    }));
    const original=await metrics();
    await page.locator('#lab-control-mascotY').fill('-30');await page.locator('#lab-control-mascotY').blur();await page.waitForTimeout(250);
    const moved=await metrics();
    assert.equal(moved.translation,'0px -30px');assert.equal(moved.font,original.font);
    assert.equal(moved.nameTop,original.nameTop);assert.equal(moved.lineBefore,original.lineBefore);assert.equal(moved.lineAfter,original.lineAfter);
    assert.deepEqual(await geometry(),dimensions);
    await page.click('#lab-undo');await page.waitForTimeout(250);assert.equal((await metrics()).translation,original.translation);
    await page.locator('#lab-control-mascotY').fill('20');await page.locator('#lab-control-mascotY').blur();await page.waitForTimeout(250);
    await search.fill('team name font');
    const teamFont=page.locator('#lab-control-schoolFont');
    const fontOptions=await teamFont.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    assert.equal(fontOptions.length,8);assert.ok(fontOptions.includes('goldman'));assert.ok(fontOptions.includes('russo'));
    await search.fill('team font size');await page.locator('#lab-control-school').fill('250');await page.locator('#lab-control-school').blur();
    await search.fill('team letter spacing');await page.locator('#lab-control-schoolSpacing').fill('4');await page.locator('#lab-control-schoolSpacing').blur();
    await search.fill('team name font');
    for(const forced of [true,false]){
    await search.fill('line break');await page.locator('#lab-control-shortenTeamNames').setChecked(forced);
    await search.fill('team name font');
    for(const font of fontOptions){
      await teamFont.selectOption(font);
      await page.waitForFunction(font=>{
        const families={scoreboard:'Cutout Scoreboard',goldman:'Cutout Goldman',russo:'Cutout Russo',graduate:'Cutout Graduate',blackops:'Cutout Black Ops',sairastencil:'Cutout Saira Stencil',squada:'Cutout Squada',upright:'Cutout Neat'};
        const family=families[font],node=document.querySelector('.cm-school');
        return getComputedStyle(node).fontFamily.includes(family)&&[...document.fonts].some(f=>f.family.replace(/["']/g,'')===family&&f.status==='loaded');
      },font);
      await page.waitForTimeout(250);
      const loaded=await page.locator('.cm-school').first().evaluate(n=>{
        const css=getComputedStyle(n);
        const family=css.fontFamily.split(',')[0].replace(/["']/g,'');
        return [...document.fonts].some(f=>f.family.replace(/["']/g,'')===family&&f.status==='loaded');
      });
      assert.ok(loaded,'Bundled font must load: '+font);assert.deepEqual(await geometry(),dimensions);
      const overflow=await page.locator('.cm-school').evaluateAll(nodes=>nodes.flatMap(n=>{
        const bounds=n.getBoundingClientRect(),rank=n.closest('.cm-face').querySelector('.cm-rankbox').getBoundingClientRect(),bad=[];
        for(const text of n.childNodes){
          if(text.nodeType!==Node.TEXT_NODE)continue;
          const range=document.createRange();range.selectNodeContents(text);
          for(const rect of range.getClientRects())if(rect.right>Math.min(bounds.right,rank.left)+1||rect.left<bounds.left-1)bad.push({name:n.dataset.fullName,font:getComputedStyle(n).fontFamily,size:n.style.fontSize,width:bounds.width,height:bounds.height,textWidth:rect.width,textHeight:rect.height,rankOverlap:rect.right-rank.left});
        }
        return bad;
      }));
      assert.deepEqual(overflow,[],'Team names must fit with '+font);
    }
    }
    await search.fill('line break');await page.locator('#lab-control-shortenTeamNames').check();await search.fill('team name font');
    await teamFont.selectOption('russo');await page.waitForTimeout(250);
    await search.fill('team name height');
    const nameGeometry=()=>page.locator('.cm-school').first().evaluate(n=>({font:n.style.fontSize,width:n.clientWidth,height:n.clientHeight,scale:new DOMMatrixReadOnly(getComputedStyle(n).transform).m22}));
    const normalName=await nameGeometry();
    await page.locator('#lab-control-schoolTallness').fill('250');await page.locator('#lab-control-schoolTallness').blur();await page.waitForTimeout(250);
    const tallerName=await nameGeometry();
    assert.equal(tallerName.scale,2.5);assert.equal(tallerName.font,normalName.font);assert.equal(tallerName.width,normalName.width);assert.equal(tallerName.height,normalName.height);
    assert.deepEqual(await geometry(),dimensions);
    await page.click('#lab-undo');await page.waitForTimeout(250);
    assert.equal((await nameGeometry()).scale,normalName.scale);
    await page.locator('#lab-control-schoolTallness').fill('135');await page.locator('#lab-control-schoolTallness').blur();await page.waitForTimeout(250);
    await search.fill('team name y');
    const namePosition=()=>page.locator('.cm-school').first().evaluate(n=>({translation:getComputedStyle(n).translate,font:n.style.fontSize,width:n.clientWidth,scale:new DOMMatrixReadOnly(getComputedStyle(n).transform).m22,mascotTop:n.nextElementSibling.getBoundingClientRect().top}));
    const originalPosition=await namePosition();
    await page.locator('#lab-control-nameY').fill('-25');await page.locator('#lab-control-nameY').blur();await page.waitForTimeout(250);
    const movedPosition=await namePosition();
    assert.equal(movedPosition.translation,'0px -25px');
    for(const key of ['font','width','scale','mascotTop'])assert.equal(movedPosition[key],originalPosition[key]);
    assert.deepEqual(await geometry(),dimensions);
    await page.click('#lab-undo');await page.waitForTimeout(250);assert.deepEqual(await namePosition(),originalPosition);
    await page.locator('#lab-control-nameY').fill('15');await page.locator('#lab-control-nameY').blur();await page.waitForTimeout(250);
    await page.click('#lab-save');await page.getByText('Saved to lab and winter board 2',{exact:true}).waitFor();
    assert.equal(saved.stats.shortenTeamNames,1);assert.equal(saved.stats.centerTeamNames,1);
    assert.equal(saved.stats.mascotY,20);
    assert.equal(saved.stats.schoolFont,'russo');
    assert.equal(saved.stats.schoolTallness,135);
    assert.equal(saved.stats.nameY,15);
    const official=await context.newPage();await official.goto('http://localhost:8139/playoff_board.html');await render(official);
    assert.equal(await official.locator('.cm-school[data-full-name="Rocky Mountain"]').first().innerHTML(),'ROCKY<br>MOUNTAIN');
    assert.equal(await official.locator('.cm-school').first().evaluate(n=>getComputedStyle(n).textAlign),'center');
    assert.equal(await official.locator('.cm-mascot').first().evaluate(n=>getComputedStyle(n).translate),'0px 20px');
    assert.match(await official.locator('.cm-school').first().evaluate(n=>getComputedStyle(n).fontFamily),/Cutout Russo/);
    assert.equal(await official.locator('.cm-school').first().evaluate(n=>new DOMMatrixReadOnly(getComputedStyle(n).transform).m22),1.35);
    assert.equal(await official.locator('.cm-school').first().evaluate(n=>getComputedStyle(n).translate),'0px 15px');
    await search.fill('rank label');
    assert.equal(await page.locator('#lab-control-rankLabel').getAttribute('max'),'500');
    assert.equal(await page.locator('#lab-control-rank').getAttribute('max'),'500');
    const label=page.locator('.cm-rankbox:not(.cm-move) .cm-rank-label').first();
    const oldHeight=await label.evaluate(n=>n.offsetHeight);
    await page.locator('#lab-control-rankLabelHeight').fill('80');await page.locator('#lab-control-rankLabelHeight').blur();await page.waitForTimeout(250);
    assert.equal(await label.evaluate(n=>n.offsetHeight),80);
    await page.click('#lab-undo');await page.waitForTimeout(250);
    assert.equal(await label.evaluate(n=>n.offsetHeight),oldHeight);
    await page.locator('#lab-control-rankLabelWidth').fill('70');await page.locator('#lab-control-rankLabelWidth').blur();await page.waitForTimeout(250);
    assert.ok(await label.evaluate(n=>Math.abs(n.clientWidth/n.parentElement.clientWidth-.7)<.03));
    await page.click('#lab-undo');await page.waitForTimeout(250);
    await search.fill('rank change label');
    const rankLabel=page.locator('.cm-rankbox:not(.cm-move) .cm-rank-label').first();
    const unchangedRankFont=await rankLabel.evaluate(n=>n.style.fontSize);
    await page.locator('#lab-control-moveLabelSize').fill('18');await page.locator('#lab-control-moveLabelSize').blur();await page.waitForTimeout(250);
    assert.ok(await page.locator('.cm-move .cm-rank-label').first().evaluate(n=>parseFloat(n.style.fontSize)<=18));
    assert.equal(await rankLabel.evaluate(n=>n.style.fontSize),unchangedRankFont);
    await search.fill('corner rounding');
    await page.locator('#lab-control-rankCorners').fill('18');await page.locator('#lab-control-rankCorners').blur();
    await page.locator('#lab-control-moveCorners').fill('12');await page.locator('#lab-control-moveCorners').blur();await page.waitForTimeout(250);
    assert.equal(await page.locator('.cm-rankbox:not(.cm-move)').first().evaluate(n=>getComputedStyle(n).borderRadius),'18px');
    assert.equal(await page.locator('.cm-rankbox.cm-move').first().evaluate(n=>getComputedStyle(n).borderRadius),'12px');
    await search.fill('divider length');
    const stat=page.locator('.cm-stat').first();
    const divider=()=>stat.evaluate(n=>({width:parseFloat(getComputedStyle(n,'::after').width),column:n.clientWidth,left:getComputedStyle(n,'::after').left,top:getComputedStyle(n,'::after').top}));
    assert.ok(Math.abs((await divider()).width/(await divider()).column-1)<.01);
    await page.locator('#lab-control-recordDividerLength').fill('65');await page.locator('#lab-control-recordDividerLength').blur();await page.waitForTimeout(250);
    const shortenedDivider=await divider();assert.ok(Math.abs(shortenedDivider.width/shortenedDivider.column-.65)<.01);
    assert.equal(await page.locator('#lab-control-rpiDividerLength').getAttribute('min'),'50');
    assert.equal(await page.locator('#lab-control-deltaDividerLength').getAttribute('max'),'100');
    await search.fill('record label x');
    await page.locator('#lab-control-recordLabelX').fill('30');await page.locator('#lab-control-recordLabelX').blur();await page.waitForTimeout(250);
    assert.deepEqual(await divider(),shortenedDivider);
    await page.click('#lab-undo');await page.click('#lab-undo');await page.waitForTimeout(250);
    assert.ok(Math.abs((await divider()).width/(await divider()).column-1)<.01);
    await search.fill('team name');await page.locator('.lab-controls').screenshot({path:'name-toggle-controls.png'});
    await page.locator('.wb-first-home').first().screenshot({path:'name-toggle-magnet.png'});
    await page.locator('.cutout-board').screenshot({path:'team-font-boundary-fix.png'});
    console.log('PASS: forced line-break threshold, full names preserved, short first words stay together, Undo, centering, fixed geometry, search, and shared saved design.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
