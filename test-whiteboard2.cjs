const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {chromium}=require('playwright');
const context={window:{}};vm.runInNewContext(fs.readFileSync('../Whiteboard-Magnet-Lab/teams.js','utf8'),context);
const teams=context.window.MAGNET_TEAMS;
(async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/lab-config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.RPI_APP_CONFIG={...window.RPI_APP_CONFIG,exportBaseUrl:location.origin};'}));
    const source=fs.readFileSync('playoff_board.js','utf8');
    await page.route('**/playoff_board.js*',route=>route.fulfill({contentType:'text/javascript',body:source.replace('function renderPlayoffCardPicture(','window.labTest={renderPlayoffCardPicture,setViewMode_}; function renderPlayoffCardPicture(')}));
    await page.goto('http://localhost:8139/playoff_board.html');await page.waitForFunction(()=>window.labTest);
    assert.equal(await page.locator('#sport option').count(),8);
    assert.equal(await page.locator('#classification option').count(),8);
    const render=async(count,side,sport='Boys Soccer',classification='Class 8A')=>{
      await page.evaluate(({count,side,sport,classification,teams})=>{
        const rows=region=>Array.from({length:count},(_,i)=>{
          const t=teams[i%teams.length];return {school:t.name.trim(),regionRank:i+1,rank:i+1,record:'11-8-0',rpi:'.50553',regionRankChange:i%3-1,rpiChange:i%3===0?-.00001:i%3===1?.00123:0,dominantHex:t.color,mapLogoUrl:'/assets/cutout-team-'+(i%24)+'.png',lineRegion:region,mascot:t.mascot,isOddExtra:i===2};
        });
        window.labTest.setViewMode_('playoff');
        window.labTest.renderPlayoffCardPicture({west:rows('West'),east:rows('East'),total:count*2,excludedTeams:[{label:'Excluded Test School',lineRegion:side}]},classification,sport,side);
      },{count,side,sport,classification,teams});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>[...document.querySelectorAll('.cutout-board .cm-logo')].every(image=>image.dataset.trimmed==='true'));
      await page.locator('.cutout-board').evaluate(async board=>Promise.all([...board.querySelectorAll('img')].map(image=>image.decode())));
      await page.waitForTimeout(150);
    };
    let referenceScoreboard;
    for(const side of ['west','east'])for(const count of [0,1,7,12,13,16,24]) {
      await render(count,side);
      assert.equal(await page.locator('.cutout-board .magnet').count(),count);
      assert.ok(await page.locator('.cm-ink-frame').evaluateAll(nodes=>nodes.every(frame=>{
        const parent=frame.parentElement;return frame.offsetHeight<=parent.clientHeight+1;
      })),'Visible ink height fits its cell');
      if(count>=7){
        assert.equal(await page.locator('.cm-move.cm-negative .cm-rank-value').first().evaluate(n=>getComputedStyle(n).rowGap),'2px');
        assert.equal(await page.locator('.cm-rankbox:not(.cm-move) .cm-rank-value').first().evaluate(n=>getComputedStyle(n).fontStyle),'normal');
      }
      for(const selector of ['.cm-mascot','.cm-stat-label','.cm-stat-value','.cm-rank-label']){
        const fonts=await page.locator(selector).evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).fontSize));
        assert.ok(new Set(fonts).size<=1,selector+' uses one shared font size');
      }
      assert.ok(await page.locator('.cm-school,.cm-mascot,.cm-stat-label,.cm-stat-value').evaluateAll(nodes=>{
        const context=document.createElement('canvas').getContext('2d');
        return nodes.every(n=>{
          const css=getComputedStyle(n);context.font=`${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
          const arrow=n.querySelector('.cm-delta-arrow'),spacing=parseFloat(css.letterSpacing)||0;
          const width=n.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)-(arrow?arrow.offsetWidth+(parseFloat(css.columnGap)||0):0);
          const lines=n.innerHTML.split(/<br\s*\/?>/).map(html=>{const div=document.createElement('div');div.innerHTML=html;return div.textContent;});
          return lines.every(line=>context.measureText(css.textTransform==='uppercase'?line.toUpperCase():line).width+Math.max(0,line.length-1)*spacing<=width+1);
        });
      }),'Team names and stats fit their text boxes');
      assert.ok(await page.locator('.magnet').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).filter==='none')),'Live text is not rasterized through the silhouette filter');
      const sizes=await page.locator('.cutout-board .magnet').evaluateAll(nodes=>nodes.map(node=>{
        const scale=new DOMMatrix(getComputedStyle(node).transform).a,card=node.querySelector('.cm-scoreboard');
        return {width:card.offsetWidth*scale,height:card.offsetHeight*scale,left:node.style.left};
      }));
      assert.ok(sizes.every(size=>Math.abs(size.width-sizes[0].width)<.01&&Math.abs(size.height-sizes[0].height)<.01),'All scoreboard sections have equal dimensions');
      if(sizes.length){
        referenceScoreboard??=sizes[0];
        assert.ok(Math.abs(sizes[0].width-referenceScoreboard.width)<.01&&Math.abs(sizes[0].height-referenceScoreboard.height)<.01,'Changing the logo roster does not rescale scoreboards');
      }
      const edges=await page.locator('.wb-magnet').evaluateAll(slots=>slots.map(slot=>({left:Number(slot.dataset.cutoutLeft),right:Number(slot.dataset.cutoutRight),second:slot.classList.contains('wb-second-column'),away:slot.classList.contains('wb-first-away')})));
      assert.ok(edges.every(edge=>edge.left>=31.99&&edge.right<=1090.01),'Cutout rim and rotated shadow stay inside the board frame');
      const secondEdges=edges.filter(edge=>edge.second),awayEdges=edges.filter(edge=>edge.away);
      assert.ok(secondEdges.every(edge=>Math.abs(edge.left-secondEdges[0].left)<.01),'Second round aligns by left silhouette');
      assert.ok(awayEdges.every(edge=>Math.abs(edge.right-awayEdges[0].right)<.01),'Away column aligns by right silhouette');
      assert.equal(await page.locator('.inner-stroke,.cm-logo-fill').count(),0);
      assert.ok(await page.locator('.cutout-board .cm-logo').evaluateAll(nodes=>nodes.every(n=>!n.dataset.fallback)));
      assert.ok(await page.locator('.cutout-board .magnet').evaluateAll(nodes=>nodes.every(node=>{
        const logo=node.querySelector('.cm-logo').getBoundingClientRect(),card=node.querySelector('.cm-scoreboard').getBoundingClientRect();return logo.height>=card.height;
      })));
      const bounds=await page.locator('.wb-surface').evaluate(surface=>{
        const rect=surface.getBoundingClientRect();return {ratio:rect.width/rect.height,inside:[...surface.querySelectorAll('.magnet')].every(card=>{const b=card.getBoundingClientRect(),logo=card.querySelector('.cm-logo').getBoundingClientRect();return Math.min(b.left,logo.left)>=rect.left&&Math.max(b.right,logo.right)<=rect.right&&Math.max(b.bottom,logo.bottom)<rect.bottom;})};
      });
      assert.ok(Math.abs(bounds.ratio-.8)<.0001);assert.ok(bounds.inside,side+' '+count+' bounds');
      const ids=await page.locator('.cutout-board filter').evaluateAll(nodes=>nodes.map(node=>node.id));assert.equal(new Set(ids).size,ids.length);
      for(const line of await page.locator('.cutout-placeholder small').allTextContents())if(/no opponent/i.test(line))assert.equal(line,'[NO OPPONENT]');
      if(count===24&&side==='west')await page.locator('.cutout-board').screenshot({path:'lab-cutout-west-24.png'});
      if(count===12&&side==='east')await page.locator('.cutout-board').screenshot({path:'lab-cutout-east-8a.png'});
      if(count>=7){
        assert.equal(await page.locator('.cm-move.cm-negative .cm-rank-value').first().evaluate(n=>getComputedStyle(n).color),'rgb(236, 8, 22)');
        assert.equal(await page.locator('.cm-stat-value.cm-positive').first().evaluate(n=>getComputedStyle(n).color),'rgb(0, 132, 42)');
      }
    }
    for(let classification=1;classification<=8;classification++){
      await render(classification%2?12:24,'west','Football','Class '+classification+'A');
      const size=await page.locator('.magnet').first().evaluate(n=>{const scale=new DOMMatrix(getComputedStyle(n).transform).a;return {width:n.offsetWidth*scale,height:n.offsetHeight*scale};});
      assert.ok(Math.abs(size.width-referenceScoreboard.width)<.01&&Math.abs(size.height-referenceScoreboard.height)<.01,'Class '+classification+'A has the same scoreboard dimensions');
    }
    await page.locator('.cm-logo').first().evaluate(image=>{image.dataset.aspect='10';document.querySelector('.cutout-board')._cutoutRefresh();});
    const wideLogoSize=await page.locator('.magnet').first().evaluate(n=>n.offsetWidth*new DOMMatrix(getComputedStyle(n).transform).a);
    assert.ok(Math.abs(wideLogoSize-referenceScoreboard.width)<.01,'An extremely wide original logo does not shrink scoreboards');
    await render(24,'west','Girls Basketball','Class 2A');
    assert.ok(await page.locator('.wb-title').evaluate(title=>{
      const range=document.createRange();range.selectNodeContents(title);
      const text=range.getBoundingClientRect(),box=title.getBoundingClientRect();
      return text.left>=box.left-1&&text.right<=box.right+1;
    }),'Uppercase sport title fits between the region and brand');
    const before=await page.locator('.wb-magnet').first().evaluate(n=>n.offsetWidth);
    await page.locator('.cutout-board').evaluate(board=>board.style.setProperty('--lab-slot-width','285px'));
    await page.waitForTimeout(150);
    assert.ok(await page.locator('.wb-magnet').first().evaluate(n=>n.offsetWidth)<before);
    await page.locator('.cutout-board').evaluate(board=>board.style.setProperty('--lab-rim','20px'));
    await page.waitForFunction(()=>document.querySelector('.magnet filter:first-child feMorphology')?.getAttribute('radius')==='24');
    assert.equal(await page.locator('.magnet filter:first-child feMorphology').first().getAttribute('radius'),'24');
    const html=await page.evaluate(()=>{
      const board=document.querySelector('.cutout-board').cloneNode(true);board.style.zoom='1';
      const links=[...document.querySelectorAll('link[rel=stylesheet]')].map(link=>link.outerHTML).join('');
      return '<!doctype html><html><head><base href="http://localhost:8139/">'+links+'</head><body class="sports-graphic-export">'+board.outerHTML+'</body></html>';
    });
    const response=await page.request.post('http://localhost:8139/export-image',{data:{html,selector:'.cutout-board'},timeout:90000});
    assert.equal(response.status(),200,await response.text().then(t=>t.slice(0,200)));
    const png=await response.body();assert.equal(png.readUInt32BE(16),3200);assert.equal(png.readUInt32BE(20),4000);fs.writeFileSync('whiteboard2-export.png',png);
    assert.equal(await page.locator('.lab-controls').count(),0);
    await page.click('#appSettingsBtn');
    assert.ok(await page.locator('#adminSecretInput').count());
    assert.equal(await page.locator('#exportPreviewTypeFilter option').count(),3);
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:'whiteboard2-mobile.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: eight classes, both regions, text fit, uniform sizing, board bounds, official controls and PNG export.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

