const fs = require('node:fs');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const source = fs.readFileSync('playoff_board.js', 'utf8');
    await page.route('**/playoff_board.js*', route => route.fulfill({
      contentType:'text/javascript',
      body:source.replace('function renderAdminOriginalNameSuggestions_()',
        'window.adminNameTest={setTeams:teams=>{teamDetailsMapResolved_=new Map(teams.map((team,i)=>[i,team]));},render:()=>renderAdminOriginalNameSuggestions_(),apply:applyLiveAdminConfig_,config:liveTeamNameNormalizeForSport_,close:setAdminManagerOpen_}; function renderAdminOriginalNameSuggestions_()')
    }));
    await page.goto('http://localhost:8138/playoff_board.html');
    await page.waitForFunction(() => window.adminNameTest);
    await page.evaluate(() => {
      window.adminNameTest.setTeams([
        {name:'Northampton Collegiate and Technical', teamClass:'Class 2A', aliases:'NCT'},
        {name:'North Lincoln', teamClass:'Class 3A'},
        {name:'Durham Charter', teamClass:'Class 1A'}
      ]);
      const classes = document.getElementById('adminClassFilter');
      classes.innerHTML = '<option value="all">All</option><option value="Class 2A">2A</option>';
      classes.value = 'all';
      const input = document.getElementById('adminAcronymFromInput');
      input.value = 'North';
      input.dispatchEvent(new Event('input', {bubbles:true}));
    });
    assert.deepEqual(await page.locator('#adminOriginalTeamNames button').evaluateAll(nodes=>nodes.map(n=>n.dataset.adminOriginalTeam)), ['North Lincoln','Northampton Collegiate and Technical']);
    await page.evaluate(() => {
      document.getElementById('adminClassFilter').value = 'Class 2A';
      window.adminNameTest.render();
    });
    assert.equal(await page.locator('#adminOriginalTeamNames button').count(), 1);
    await page.locator('#adminOriginalTeamNames button').evaluate(n=>n.click());
    assert.equal(await page.locator('#adminAcronymFromInput').inputValue(),'Northampton Collegiate and Technical');
    assert.equal(await page.locator('#adminOriginalTeamNames').evaluate(n=>n.hidden),true);
    await page.evaluate(() => {
      const test = window.adminNameTest;
      const first = test.config('boys_soccer','Class 1A');
      if(first !== test.config('boys_soccer','Class 1A')) throw new Error('Scope compiled more than once');
      test.apply({TeamNameNormalize:{acronymOverrides:{'north lincoln':'NL'}}});
      const next = test.config('boys_soccer','Class 1A');
      if(next === first || next.acronymOverrides['north lincoln'] !== 'NL') throw new Error('Saved config did not rebuild matching scope');
      test.setTeams([{name:'Updated Team',teamClass:'Class 2A'}]);
      const input = document.getElementById('adminAcronymFromInput');
      input.value = 'Updated';
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    assert.equal(await page.locator('#adminOriginalTeamNames button').textContent().then(text=>text.includes('Updated Team')),true);
    await page.evaluate(()=>window.adminNameTest.close(false));
    assert.equal(await page.locator('#adminOriginalTeamNames').evaluate(n=>n.hidden),true);
    assert.deepEqual(errors, []);
    console.log('Original-name suggestions: input filtering, exact team names and class scope passed.');
  } finally {
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
