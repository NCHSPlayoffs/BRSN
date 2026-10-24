const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1100}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8139/playoff_board.html');
    await page.click('#appSettingsBtn');
    await page.locator('summary').filter({hasText:'Export as PNG'}).click();
    await page.click('#exportBtn');
    await page.click('#exportPreviewClassMenuBtn');
    await page.check('#exportPreviewSelectAllClasses');
    await page.click('#exportPreviewClassMenuBtn');
    await page.selectOption('#exportPreviewSport','Football');
    await page.click('#buildExportPreviewBtn');
    await page.waitForFunction(()=>/^(Ready|Build failed)/.test(document.querySelector('#exportPreviewStatus').textContent),null,{timeout:300000});
    const result=await page.evaluate(()=>({status:document.querySelector('#exportPreviewStatus').textContent,count:document.querySelector('#exportRenderCount').textContent,failed:[...document.querySelectorAll('.is-error')].map(n=>n.textContent),downloadDisabled:document.querySelector('#downloadAllExportsBtn').disabled}));
    console.log(JSON.stringify(result));
    assert.deepEqual(result.failed,[]);
    assert.equal(result.downloadDisabled,false);
    assert.equal(result.count,'24 / 24 rendered');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'batch-export-passed.png'});
    console.log('PASS: all eight classes, both regions plus standings, 24 PNGs ready for Download All.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
