const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1100}});
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    const source = fs.readFileSync('playoff_board.js','utf8');
    await page.route('**/playoff_board.js*',route => route.fulfill({contentType:'text/javascript',body:source.replace('function renderPlayoffCardPicture(', 'window.winterTest={renderPlayoffCardPicture,setViewMode_}; function renderPlayoffCardPicture(')}));
    await page.goto('http://localhost:8138/playoff_board.html');
    await page.waitForFunction(() => window.winterTest);
    const render = async (count,side,notes=false,sport='Girls Basketball',classification='Class 2A') => {
      await page.evaluate(({count,side,notes,sport,classification}) => {
        const rows = side => Array.from({length:count},(_,i) => ({school:`${side} School ${i+1}`,regionRank:i+1,rank:i+1,record:'12-3-0',rpi:'.65432',regionRankChange:i%3-1,rpiChange:i%3===0?.02345:i%3===1?-.01234:0,dominantHex:i%2?'#007070':'#c81d35',mapLogoUrl:'/NCHSAALOGO.png',lineRegion:side,mascot:'Wildcats',isOddExtra:notes&&i===2}));
        window.winterTest.setViewMode_('playoff');
        window.winterTest.renderPlayoffCardPicture({west:rows('West'),east:rows('East'),total:count*2,excludedTeams:notes?[{label:'Excluded Test School',record:'0-0-0',lineRegion:side}]:[]},classification,sport,side);
      },{count,side,notes,sport,classification});
      await page.evaluate(() => document.fonts.ready);
    };
    for (const side of ['west','east']) for (const count of [0,1,2,4,7,8,12,13,14,15,16,20,23,24]) {
      await render(count,side);
      assert.equal(await page.locator('.whiteboard-playoff').count(),1);
      assert.equal(await page.locator('.wb-surface feMorphology').getAttribute('radius'),'2');
      if(count) assert.ok(await page.locator('.wb-logo').first().evaluate(n=>getComputedStyle(n).filter.includes('wb-logo-white-stroke-')));
      assert.equal(await page.locator('.wb-magnet:not(.wb-placeholder)').count(),count);
      const opponentLabels = await page.locator('.wb-detail').allTextContents();
      for (const label of opponentLabels.filter(text=>/no opponent/i.test(text))) assert.equal(label,'[NO OPPONENT]');
      const geometry = await page.evaluate(() => {
        const surface=document.querySelector('.wb-surface').getBoundingClientRect();
        const cards=[...document.querySelectorAll('.wb-magnet')];
        return {ratio:surface.width/surface.height,widths:cards.map(c=>c.offsetWidth),heights:cards.map(c=>c.offsetHeight),inside:cards.every(c=>{const b=c.getBoundingClientRect();return b.left>=surface.left&&b.right<=surface.right&&b.bottom<surface.bottom;})};
      });
      assert.ok(Math.abs(geometry.ratio-.8)<.0001);
      assert.equal(new Set(geometry.widths).size,count?1:0);
      assert.equal(new Set(geometry.heights).size,count?1:0);
      assert.ok(geometry.inside,`${side} ${count} card bounds`);
      if(count) {
        assert.ok(await page.locator('.wb-logo').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).width)<=80.1)), 'Logos remain card-sized');
        assert.ok(await page.locator('.wb-stat>span:first-child').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)<=14.1)), 'Stat labels retain compact typography');
      }
      assert.equal(await page.locator('.wb-region-label').evaluate(n=>getComputedStyle(n).zIndex),'2');
      assert.equal(await page.locator('.wb-head').first().evaluate(n=>getComputedStyle(n).borderTopWidth),'0px');
      assert.ok(await page.locator('.wb-surface').evaluate(n=>getComputedStyle(n).backgroundImage.includes('eraser-v4.png')));
      assert.ok(await page.locator('.wb-footer,.wb-footer-stroke').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).display==='none')));
      assert.equal(await page.locator('.wb-region-name').textContent(),side.toUpperCase());
      assert.equal(await page.locator('.wb-frame-overlay:not(.wb-frame-marker)').count(),1);
      assert.equal(await page.locator('.wb-cork').count(),1);
      assert.ok(await page.locator('.wb-cork').evaluate(n=>getComputedStyle(n).backgroundImage.includes('cork-strip-4200x500.png')));
      const frame = await page.locator('.wb-frame-overlay:not(.wb-frame-marker)').evaluate(async n=>{
        await n.decode();
        const c=document.createElement('canvas');c.width=100;c.height=125;
        const ctx=c.getContext('2d');ctx.drawImage(n,0,0,100,125);
        return {src:n.getAttribute('src'),alpha:ctx.getImageData(50,60,1,1).data[3],z:Number(getComputedStyle(n).zIndex)};
      });
      assert.ok(frame.src.endsWith('frame-west-slim-markers-overlay.png'));
      assert.equal(await page.locator('.wb-timestamp .graphic-updated').count(),1);
      assert.ok(await page.locator('.wb-timestamp').evaluate((n,side)=>getComputedStyle(n,'::before').backgroundImage.includes(`torn-paper-${side==='east'?'blue':'red'}.png`),side));
      assert.equal(await page.locator('.wb-timestamp').evaluate(n=>getComputedStyle(n).color),'rgb(0, 0, 0)');
      assert.equal(frame.alpha,0);assert.equal(frame.z,20);
      assert.equal(await page.locator('.wb-brand-red').evaluate(n=>getComputedStyle(n).color),'rgb(229, 27, 35)');
      if(count>=4) {
        assert.equal(await page.locator('[data-move=pos] .wb-move').first().evaluate(n=>getComputedStyle(n).color),'rgb(18, 115, 56)');
        assert.equal(await page.locator('[data-move=neg] .wb-move').first().evaluate(n=>getComputedStyle(n).color),'rgb(185, 36, 48)');
        assert.equal(await page.locator('.wb-delta.positive .wb-value').first().evaluate(n=>getComputedStyle(n).color),'rgb(18, 115, 56)');
        assert.equal(await page.locator('.wb-delta.negative .wb-value').first().evaluate(n=>getComputedStyle(n).color),'rgb(185, 36, 48)');
        assert.ok(await page.locator('.wb-winner-vs').evaluateAll(nodes=>nodes.every(n=>n.style.left==='37px')));
        assert.ok(await page.locator('.wb-magnet').evaluateAll(nodes=>nodes.every(n=>Math.abs(parseFloat(n.style.getPropertyValue('--wb-angle')))<=.8)));
      }
      if (count===24) await page.locator('.whiteboard-playoff').screenshot({path:`winter-${side}-24-preview.png`});
    }
    for(const side of ['east','west']) for(const count of [8,10,11,12,13]) {
      await render(count,side,true,'Football','Class 8A');
      assert.equal(await page.locator('.wb-magnet:not(.wb-placeholder)').count(),count);
      assert.equal(new Set(await page.locator('.wb-magnet').evaluateAll(nodes=>nodes.map(n=>n.offsetHeight))).size,1);
      assert.ok(await page.locator('.wb-logo').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).width)<=80.1)));
      assert.ok(await page.locator('.wb-stat>span:first-child').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)), '8A stat labels fit on one line');
      assert.ok(await page.locator('.wb-stats').evaluateAll(nodes=>nodes.every(n=>n.scrollHeight<=n.clientHeight+1)), '8A stat values are not clipped');
      if(count===12) await page.locator('.whiteboard-playoff').screenshot({path:`winter-${side}-8a-preview.png`});
    }
    for(const sport of ['Football','Boys Soccer','Girls Soccer','Volleyball','Boys Basketball','Girls Basketball','Baseball','Softball']) {
      await render(24,'west',false,sport);
      assert.equal(await page.locator('.wb-sport-magnet').count(),1);
      const image = await page.locator('.wb-sport-magnet').evaluate(async n => {
        await n.decode();
        const c=document.createElement('canvas');c.width=128;c.height=128;
        const ctx=c.getContext('2d');ctx.drawImage(n,0,0,128,128);
        return {src:n.getAttribute('src'),width:n.naturalWidth,alpha:ctx.getImageData(0,0,1,1).data[3]};
      });
      assert.ok(image.src.endsWith(`magnet-${sport.toLowerCase().split(' ').at(-1)}.png`));
      assert.ok(image.width>0);assert.equal(image.alpha,0);
    }
    await render(13,'east',true);
    const controls = await page.evaluate(() => {
      const board=document.querySelector('.whiteboard-playoff');
      const home=document.querySelector('.wb-first-home'),away=document.querySelector('.wb-first-away');
      const before={home:home.offsetLeft,away:away.offsetLeft,width:home.offsetWidth};
      const gap = parseFloat(getComputedStyle(board).getPropertyValue('--wb-matchup-gap'));
      board.style.setProperty('--wb-matchup-gap',`${gap+20}px`);
      board.style.setProperty('--wb-connector-height','80px');
      board.style.setProperty('--wb-connector-cap','20px');
      const result={homeShift:home.offsetLeft-before.home,awayShift:away.offsetLeft-before.away,width:home.offsetWidth,
        originalWidth:before.width,height:document.querySelector('.wb-connector').offsetHeight,
        capWidth:document.querySelector('.wb-connector-cap').getBoundingClientRect().width / (document.querySelector('.wb-surface').getBoundingClientRect().width/1122)};
      for(const name of ['--wb-matchup-gap','--wb-connector-height','--wb-connector-cap']) board.style.removeProperty(name);
      return result;
    });
    assert.equal(controls.homeShift,-10);assert.equal(controls.awayShift,10);
    assert.equal(controls.width,controls.originalWidth);assert.equal(controls.height,80);
    assert.ok(Math.abs(controls.capWidth-20)<.01);
    assert.equal(await page.locator('.wb-highlighted').count(),1);
    assert.equal(await page.locator('.wb-odd-coin').count(),1);
    assert.equal(await page.locator('.wb-note-coin').count(),1);
    assert.equal(await page.locator('.wb-note span').textContent(),'= Coin flip decides if the team will be in the East/West at the end of the season');
    for (const selector of ['.wb-odd-coin','.wb-note-coin']) await page.locator(selector).evaluate(n=>n.decode());
    const highlight = await page.locator('.wb-highlighted').evaluate(n=>({shadow:getComputedStyle(n).boxShadow,rank:getComputedStyle(n.querySelector('.wb-rank-stack')).backgroundColor}));
    assert.ok(!highlight.shadow.includes('8, 127, 232'));
    assert.equal(highlight.rank,'rgb(255, 251, 234)');
    assert.equal(await page.locator('.wb-note').count(),1);
    assert.ok((await page.locator('.wb-note .wb-sticky-copy').evaluate(n=>getComputedStyle(n).fontFamily)).includes('WB Pen'));
    assert.ok(await page.locator('.wb-sticky-copy span,.wb-sticky-copy div').evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).fontFamily===getComputedStyle(n.closest('.wb-sticky-copy')).fontFamily && getComputedStyle(n).fontWeight==='600')), 'Both notes and their children use the same pen font');
    assert.equal(await page.locator('.wb-sticky').count(),2);
    assert.equal(await page.locator('.wb-sticky .wb-push-pin').count(),2);
    assert.equal(await page.locator('.wb-timestamp .wb-push-pin').count(),1);
    assert.equal(await page.locator('.wb-excluded-bullet').count(),await page.locator('.wb-excluded-team').count());
    assert.ok(await page.locator('.wb-push-pin').evaluateAll(async nodes=>{await Promise.all(nodes.map(n=>n.decode()));return nodes.every(n=>n.src.endsWith('push-pin-blue-overhead.png') && n.naturalWidth>0);}));
    assert.ok(await page.locator('.wb-magnet').evaluateAll(nodes=>nodes.every(n=>Number(getComputedStyle(n).zIndex)>Number(getComputedStyle(document.querySelector('.wb-sticky')).zIndex))), 'Team magnets overlap the notes');
    assert.equal(await page.locator('.wb-coin-anchor').evaluate(n=>getComputedStyle(n).zIndex),'41');
    assert.ok(await page.locator('.wb-sticky').evaluateAll(nodes=>nodes.every(n=>Number(getComputedStyle(n).zIndex)>20)));
    assert.ok(await page.locator('.wb-sticky-copy').evaluateAll(nodes=>nodes.every(n=>n.scrollHeight<=n.clientHeight+1)));
    assert.equal(await page.locator('.wb-excluded').count(),1);
    assert.ok(await page.locator('.wb-excluded-team').evaluateAll(nodes=>nodes.every(n=>! /\(\d+-\d+(?:-\d+)?\)/.test(n.textContent))), 'Excluded notes omit records');
    await page.locator('.whiteboard-playoff').screenshot({path:'winter-notes-preview.png'});
    for (const count of [13,24]) {
      await render(count,'east',true);
      const exportHtml = await page.evaluate(() => {
        const board=document.querySelector('.whiteboard-playoff').cloneNode(true); board.style.zoom='1';
        const links=[...document.querySelectorAll('link[rel=stylesheet]')].map(n=>n.outerHTML).join('');
        return '<!doctype html><html><head><base href="http://localhost:8138/">'+links+'</head><body class="sports-graphic-export">'+board.outerHTML+'</body></html>';
      });
      const response=await page.request.post('http://localhost:8138/export-image',{data:{html:exportHtml,selector:'.whiteboard-playoff'},timeout:90000});
      assert.equal(response.status(),200,await response.text().then(t=>t.slice(0,200)));
      const png=await response.body();
      assert.equal(png.readUInt32BE(16),3200);assert.equal(png.readUInt32BE(20),4000);
      fs.writeFileSync(`winter-${count}-export.png`,png);
    }
    await page.evaluate(() => {
      const board=document.querySelector('.whiteboard-playoff');
      const original=board.innerHTML;
      // Reapply is idempotent: cloned export boards are already complete.
      window.WhiteboardPlayoff.apply(board);
      if(board.innerHTML!==original) throw new Error('Adapter changed an already rendered board');
    });
    await page.setViewportSize({width:390,height:844});
    await page.locator('.whiteboard-playoff').screenshot({path:'winter-mobile-preview.png'});
    assert.deepEqual(errors,[]);
    console.log('Whiteboard: both regions, 0-24 teams, uniform sizing, notes, 4:5 bounds, 3200x4000 exports, idempotence and mobile passed.');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
