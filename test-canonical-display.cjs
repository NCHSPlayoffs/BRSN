const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch();
  try{
    const context=await browser.newContext();
    await context.route('https://**',r=>r.fulfill({json:{}}));
    await context.route('**/lab-config.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
    for(const [root,url] of [
      ['C:/RPIRANKINGS/BRSN-WINTER-WHITEBOARD','http://localhost:8125/board.html'],
      ['C:/RPIRANKINGS/winter-white-board2','http://localhost:8139/playoff_board.html']
    ]){
      const source=fs.readFileSync(root+'/playoff_board.js','utf8')+'\nwindow.displayTest={applyLiveAdminConfig_,liveTeamNameNormalizeForSport_,canonicalTeamName_,liveDisplayTeamName_,createTeamDetailLookup_};';
      const page=await context.newPage();
      await page.route('**/playoff_board.js*',r=>r.fulfill({contentType:'text/javascript',body:source}));
      await page.goto(url,{waitUntil:'domcontentloaded'});
      const result=await page.evaluate(()=>{
        const api=window.displayTest;
        api.applyLiveAdminConfig_({
          TeamNameNormalize:{acronymOverrides:{
            'a c reynolds':'A C Reynolds',
            'ac reynolds':'AC Reynolds',
            'north carolina school for the deaf':'NC School for the Deaf',
            'triad math and science academy':'Triad Math & Science',
            'southeast collegiate prep':'SE Collegiate'
          }},
          TeamNameNormalizeBySport:{football:{acronymOverrides:{'a.c. reynolds':'AC Football'}}},
          TeamNameNormalizeBySportClass:{football:{'3A':{acronymOverrides:{'ac reynolds':'AC Class'}}}}
        });
        const all=api.liveTeamNameNormalizeForSport_('all');
        const football=api.liveTeamNameNormalizeForSport_('football');
        const class3=api.liveTeamNameNormalizeForSport_('football','3A');
        const detail={name:'A.C. Reynolds',keyName:'A C Reynolds',logoUrl:'test-logo.png'};
        const map=new Map([['A C Reynolds',detail]]);
        const lookup=api.createTeamDetailLookup_(map,all);
        return {
          display:['A.C. Reynolds','A C Reynolds','AC Reynolds','a.c reynolds high school'].map(n=>api.liveDisplayTeamName_(n,all)),
          matching:['A.C. Reynolds','A C Reynolds','AC Reynolds'].map(n=>api.canonicalTeamName_(n,all)),
          details:lookup('A.C. Reynolds')===detail&&lookup('A C Reynolds')===detail,
          sport:api.liveDisplayTeamName_('A.C. Reynolds',football),
          classification:api.liveDisplayTeamName_('A C Reynolds',class3),
          others:['North Carolina School for the Deaf','Triad Math and Science Academy','S E Collegiate Prep'].map(n=>api.liveDisplayTeamName_(n,all)),
          noOverride:api.liveDisplayTeamName_('Shelby High School',all),
          initials:['T.C. Roberson','T C Roberson','R.J. Reynolds','J. F. Webb','NC School for the Deaf','Mt. Airy','t.c. roberson'].map(n=>({
            display:api.liveDisplayTeamName_(n,all),
            matching:api.canonicalTeamName_(n,all)
          })),
          manualSpaced:(()=>{
            api.applyLiveAdminConfig_({TeamNameNormalize:{acronymOverrides:{'t c roberson':'T C Roberson'}}});
            return api.liveDisplayTeamName_('T.C. Roberson',api.liveTeamNameNormalizeForSport_('all'));
          })()
        };
      });
      assert.deepEqual(result.display,Array(4).fill('AC Reynolds'));
      assert.deepEqual(result.matching,['A C Reynolds','A C Reynolds','AC Reynolds']);
      assert.equal(result.details,true);
      assert.equal(result.sport,'AC Football');
      assert.equal(result.classification,'AC Class');
      assert.deepEqual(result.others,['NC School for the Deaf','Triad Math & Science','SE Collegiate']);
      assert.equal(result.noOverride,'Shelby');
      assert.deepEqual(result.initials,[
        {display:'TC Roberson',matching:'T C Roberson'},
        {display:'TC Roberson',matching:'T C Roberson'},
        {display:'RJ Reynolds',matching:'R J Reynolds'},
        {display:'JF Webb',matching:'J F Webb'},
        {display:'NC School for the Deaf',matching:'NC School for the Deaf'},
        {display:'Mt Airy',matching:'Mt Airy'},
        {display:'TC roberson',matching:'t c roberson'}
      ]);
      assert.equal(result.manualSpaced,'T C Roberson');
      await page.close();
    }
    console.log('PASS: canonical display precedence, spaced initials, sport/class priority, exact punctuation, unchanged matching keys, and team-detail lookup in lab and official.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
