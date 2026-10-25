const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');

(async()=>{
 const root=__dirname,types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ttf':'font/ttf','.woff2':'font/woff2','.geojson':'application/json'};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/BRSN/')){res.writeHead(404).end();return;}
  const file=path.resolve(root,decodeURIComponent(url.pathname.slice(6))||'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,bytes)=>{
   if(error){res.writeHead(404).end();return;}
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
   if(path.basename(file)==='app-config.js')bytes=Buffer.from(bytes.toString()+"\nwindow.RPI_APP_CONFIG.staticHosting=true;window.RPI_APP_CONFIG.exportBaseUrl='';");
   res.end(bytes);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[],pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/BRSN/')&&!r.url().endsWith('favicon.ico'))errors.push({url:r.url(),status:r.status()});});
  await page.goto(process.env.PAGES_URL||'http://127.0.0.1:'+server.address().port+'/BRSN/playoff_board.html');
  await page.evaluate(async()=>{
   await window.CutoutBoard.ready;
   document.getElementById('classification').value='Class 3A';document.getElementById('sport').value='Football';
   await loadRankings();
  });
  assert.ok(await page.locator('#tbody tr').count()>20,'Live RPI standings must load');
  await page.evaluate(()=>buildPlayoffView_({layout:'cards',side:'west'}));
  await page.locator('.cutout-board .magnet').first().waitFor();
  await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.cutout-board img')].map(n=>n.decode().catch(()=>{})));await document.fonts.ready;});
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.cutout-board .magnet').count(),24);
  const design=JSON.parse(fs.readFileSync('data/whiteboard-design.json','utf8'));
  assert.equal(await page.locator('.cutout-board').evaluate(n=>n.style.getPropertyValue('--lab-school-font').includes('Cutout')),true);
  assert.equal(await page.locator('.cutout-board').evaluate(n=>n.style.getPropertyValue('--lab-school-tallness')),String((design.stats.schoolTallness||100)/100));
  const imageState=await page.locator('.cutout-board img').evaluateAll(nodes=>nodes.filter(n=>!n.naturalWidth).map(n=>n.src));
  assert.deepEqual(imageState,[]);
  await page.locator('.cutout-board').screenshot({path:path.join(require('node:os').tmpdir(),'whiteboard-pages-preview.png')});
  const exported=await page.evaluate(async()=>{
   const job=await createCurrentRenderedExportJob_('.playoff-board','playoff_board','Class 3A','Football');
   const blob=await job.blobPromise,bitmap=await createImageBitmap(blob);
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=400;
   const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,320,400);
   const pixels=ctx.getImageData(0,0,320,400).data;let red=0,dark=0,connectorRed=0,paperRed=0,headerRed=0;
   for(let i=0;i<pixels.length;i+=4){
    const x=(i/4)%320,y=Math.floor(i/4/320),isRed=pixels[i]>150&&pixels[i+1]<100&&pixels[i+2]<110;
    if(isRed){red++;if(x>100&&x<120&&y>50&&y<340)connectorRed++;if(x>125&&x<215&&y>350&&y<375)paperRed++;if(y>30&&y<47)headerRed++;}
    if(pixels[i]<90&&pixels[i+1]<90&&pixels[i+2]<90)dark++;
   }
   const data=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
   return {width:bitmap.width,height:bitmap.height,red,dark,connectorRed,paperRed,headerRed,data};
  });
  assert.equal(exported.width,3200);assert.equal(exported.height,4000);assert.ok(exported.red>150&&exported.dark>300,'PNG must contain the header, connectors, logos and text');
  assert.ok(exported.connectorRed>100&&exported.paperRed>300&&exported.headerRed>200,'Export must preserve connector strokes, timestamp paper and round-header borders');
  fs.writeFileSync(path.join(require('node:os').tmpdir(),'whiteboard-pages-export.png'),Buffer.from(exported.data.split(',')[1],'base64'));
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>buildPlayoffView_({layout:'cards',side:'east'}));
  await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('.cutout-board img')].map(n=>n.decode().catch(()=>{})));});
  assert.equal(await page.locator('.cutout-board').getAttribute('data-region'),'east');
  assert.equal(await page.locator('.cutout-board .magnet').count(),24);
  assert.equal(await page.locator('.cutout-board img').evaluateAll(nodes=>nodes.filter(n=>!n.naturalWidth).length),0);
  await page.locator('.cutout-board').screenshot({path:path.join(require('node:os').tmpdir(),'whiteboard-pages-mobile-east.png')});
  await page.evaluate(async()=>{document.getElementById('classification').value='Class 8A';await buildPlayoffView_({layout:'cards',side:'west'});});
  assert.equal(await page.locator('.cutout-board .magnet').count(),12,'8A smaller field must retain its layout');
  assert.deepEqual(pageErrors,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({status:'PASS',rpi:'live',magnets:24,mobileEast:true,smallField:12,export:[exported.width,exported.height],staticErrors:errors,pageErrors}));
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
