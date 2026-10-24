const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage();
  let sheetRequests=0;
  await page.route('**/gviz/tq?*',route=>{sheetRequests++;return route.abort();});
  await page.route('**/team-details',route=>route.fulfill({json:{syncedAt:'2026-09-25T12:00:00Z',teamCount:1,table:{cols:[{id:'A'},{id:'B'},{id:'C',label:'Name'},{id:'D',label:'Aliases'},{id:'E',label:'Mascot'},{id:'F',label:'Longitude'}],rows:[{c:[null,null,{v:'Test School'},{v:'Test Alias'},{v:'Test Mascot'},{v:'-78.5'}]}]}}}));
  const source=fs.readFileSync('playoff_board.js','utf8');
  await page.route('**/playoff_board.js*',r=>r.fulfill({contentType:'text/javascript',body:source+'\nwindow.getTestDetails=getTeamDetailsMapCached_;'}));
  await page.goto('http://localhost:8124/playoff_board.html');
  const result=await page.evaluate(async()=>[...(await window.getTestDetails()).values()].map(row=>({name:row.name,mascot:row.mascot,longitude:row.longitude})));
  assert.ok(result.some(row=>row.name==='Test School'&&row.mascot==='Test Mascot'&&row.longitude==='-78.5'));
  assert.equal(sheetRequests,0,'Saved details must not contact Google Sheets');
  console.log('Supabase team details load with zero spreadsheet requests.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
