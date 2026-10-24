const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch();
  try{
    const source=fs.readFileSync('playoff_board.js','utf8').replace('async function renderEastWestMap_() {',`window.whiteboardMapTest={
      async render(lineData,clean){eastWestLineMapState_={lineData,classification:'Class 3A',sportLabel:'Football'};eastWestMapCleanView_=clean;await openEastWestMap_();},
      clean(value){eastWestMapCleanView_=value;applyEastWestMapZoom_({forcePlacement:true});},
      zoom(){eastWestMapTransform_.scale=1.4;applyEastWestMapZoom_({forcePlacement:true});},
      zoomEdges(){eastWestMapTransform_.scale=3;eastWestMapTransform_.x=-1200;eastWestMapTransform_.y=-600;applyEastWestMapZoom_({forcePlacement:true});},
      pan(){eastWestMapTransform_.x=99999;eastWestMapTransform_.y=-99999;applyEastWestMapZoom_({forcePlacement:true});return {...eastWestMapTransform_};},
      exportHtml:buildEastWestMapExportHtml_
    }; async function renderEastWestMap_() {`);
    const coords=[[-83.5,35.4],[-82.6,35.6],[-82.59,35.6],[-82.57,35.62],[-81.6,35.3],[-81.3,35.75],[-80.85,35.2],[-80.84,35.21],[-80.83,35.19],[-80.7,36.2],[-80.2,36.1],[-80.19,36.1],[-79.8,36.1],[-79.4,35.7],[-78.65,35.8],[-78.64,35.8],[-78.62,35.82],[-77.4,35.6],[-77.9,34.3],[-76.7,36.1]];
    const rows=coords.map(([longitude,latitude],i)=>({school:'Map Test Team '+i,longitude,latitude,rank:i+1,regionRank:i%10+1,rpi:'.55000',mapLogoUrl:'http://localhost:8139/assets/cutout-team-'+i+'.png',lineRegion:i<10?'West':'East'}));
    const lineData={west:rows.slice(0,10).reverse(),east:rows.slice(10).reverse()};
    for(const url of ['http://localhost:8125/board.html','http://localhost:8139/playoff_board.html']){
      const page=await browser.newPage({viewport:{width:1440,height:1000}});
      await page.route('**/playoff_board.js*',r=>r.fulfill({contentType:'text/javascript',body:source}));
      await page.route('https://**',r=>r.fulfill({json:{}}));
      await page.route('**/lab-config.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
      await page.goto(url,{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>!!window.whiteboardMapTest);
      await page.evaluate(async data=>{await window.whiteboardMapTest.render(data,true);await document.fonts.ready;},lineData);
      await page.waitForTimeout(600);
      const geometry=await page.evaluate(()=>{
        const svg=document.querySelector('.whiteboard-map-svg');
        return {counties:svg.querySelectorAll('.nc-map-county-line').length,
          fills:[...svg.querySelectorAll('.nc-map-shape,.nc-map-county-line')].map(n=>getComputedStyle(n).fill),
          colors:[...svg.querySelectorAll('.nc-map-shape')].map(n=>getComputedStyle(n.closest('.wb-map-region')).color),
          cut:getComputedStyle(svg.querySelector('.nc-map-cut-line')).stroke,
          markers:svg.querySelectorAll('.nc-map-marker image').length,
          filters:[...svg.querySelectorAll('.nc-map-marker image')].every(n=>n.style.filter.includes('-magnet')),
          lines:svg.querySelectorAll('.wb-map-location-lines path').length,
          offsets:svg.querySelectorAll('.nc-map-marker.is-offset').length};
      });
      assert.ok(geometry.counties>=200);
      assert.ok(geometry.fills.every(fill=>fill==='none'));
      assert.deepEqual(geometry.colors,['rgb(229, 27, 35)','rgb(8, 127, 232)']);
      assert.equal(geometry.cut,'rgb(34, 34, 34)');
      assert.equal(geometry.markers,20);assert.ok(geometry.filters);
      assert.ok(await page.locator('.nc-map-shape').first().evaluate(n=>{const b=n.getBBox();return b.width/b.height>2.5;}));
      assert.ok(geometry.lines>0);assert.equal(geometry.lines,geometry.offsets);
      assert.equal(await page.locator('img.east-west-map-brand').count(),0);
      assert.equal(await page.locator('.wb-map-wordmark').count(),2);
      assert.equal(await page.locator('.wb-map-backdrop').count(),0);
      assert.equal(await page.locator('.wb-map-board').count(),1);
      assert.ok(await page.locator('.wb-map-brand-name').first().evaluate(n=>getComputedStyle(n).fontFamily.includes('Map Marker')));
      assert.ok(await page.locator('.wb-map-board').evaluate(n=>{const a=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<1;}));
      assert.equal(await page.locator('.wb-map-location-lines').evaluate(n=>getComputedStyle(n).opacity),'0.62');
      assert.ok(await page.locator('.nc-map-note').evaluate(n=>!n.closest('#eastWestMapViewport') && parseFloat(getComputedStyle(n).fontSize)>=30));
      assert.ok(await page.locator('.nc-map-legend').first().evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=44));
      assert.ok(await page.locator('.wb-map-surface-clip').evaluate(n=>{const svg=n.closest('svg'),id=n.getAttribute('clip-path').slice(4,-1),rect=svg.querySelector(id+' rect'),view=svg.viewBox.baseVal;return Number(rect.getAttribute('x'))===view.x&&Math.abs(Number(rect.getAttribute('y'))-view.y)<.01&&Math.abs(Number(rect.getAttribute('height'))-view.height)<.01;}));
      assert.ok(await page.locator('.nc-map-shape').first().evaluate(n=>getComputedStyle(n).stroke.includes('ink-west')));
      assert.equal(await page.locator('.east-west-map-title').evaluate(n=>getComputedStyle(n).webkitTextFillColor),'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('.wb-map-surface-clip').count(),1);
      await page.evaluate(()=>window.whiteboardMapTest.clean(false));
      assert.equal(await page.locator('.wb-map-location-lines path').count(),0);
      await page.evaluate(()=>{window.whiteboardMapTest.clean(true);window.whiteboardMapTest.zoom();});
      assert.ok(await page.locator('.wb-map-location-lines path').count()>0);
      assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.wb-map-location-lines path')].every(line=>[...document.querySelectorAll('.nc-map-marker.is-offset')].some(m=>m.dataset.drawX===Number(line.dataset.endX).toFixed(2) && m.dataset.drawY===Number(line.dataset.endY).toFixed(2)))));
      const transform=await page.evaluate(()=>window.whiteboardMapTest.pan());
      assert.ok(Math.abs(transform.x)<2000 && Math.abs(transform.y)<2000);
      await page.evaluate(data=>window.whiteboardMapTest.render(data,true),lineData);
      await page.waitForTimeout(300);
      if(url.includes('8139')){
        await page.locator('.east-west-map-panel').screenshot({path:'whiteboard-map-desktop.png'});
        await page.evaluate(()=>window.whiteboardMapTest.zoomEdges());
        await page.locator('.east-west-map-panel').screenshot({path:'whiteboard-map-zoom.png'});
        await page.evaluate(data=>window.whiteboardMapTest.render(data,true),lineData);
        const html=await page.evaluate(()=>window.whiteboardMapTest.exportHtml());
        assert.ok(html.includes('wb-map-location-lines'));
        assert.ok(html.includes('map-whiteboard.png'));
        const response=await page.request.post('http://localhost:8139/export-image',{data:{html,selector:'.east-west-map-panel'},timeout:90000});
        assert.equal(response.status(),200);
        const png=await response.body();assert.ok(png.readUInt32BE(16)>1000);
        const colors=await page.evaluate(async src=>{
          const image=new Image();image.src=src;await image.decode();
          const canvas=document.createElement('canvas');canvas.width=600;canvas.height=450;
          const context=canvas.getContext('2d');context.drawImage(image,0,0,600,450);
          const pixels=context.getImageData(0,0,600,450).data;let red=0,blue=0;
          for(let i=0;i<pixels.length;i+=4){if(pixels[i]>160&&pixels[i+1]<100&&pixels[i+2]<110)red++;if(pixels[i]<70&&pixels[i+1]>80&&pixels[i+2]>160)blue++;}
          return {red,blue};
        },'data:image/png;base64,'+png.toString('base64'));
        assert.ok(colors.red>200 && colors.blue>200);
        fs.writeFileSync('whiteboard-map-export.png',png);
        await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
        assert.ok(await page.locator('.whiteboard-map-svg').evaluate(svg=>Math.abs(svg.viewBox.baseVal.height/svg.viewBox.baseVal.width-svg.clientHeight/svg.clientWidth)<.01));
        assert.equal(await page.locator('#eastWestMapClassPickerText').evaluate(n=>getComputedStyle(n).color),'rgb(32, 34, 38)');
        await page.locator('.east-west-map-panel').screenshot({path:'whiteboard-map-mobile.png'});
      }
      await page.close();
    }
    console.log('PASS: Lab and official county outlines, region colors, magnet filters, clean-view location lines, zoom updates, and PNG export.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
