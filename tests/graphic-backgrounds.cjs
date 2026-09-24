const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const validatorSource = fs.readFileSync('supabase/functions/_shared/graphic-backgrounds.js', 'utf8');
  const { validateBackground } = await import('data:text/javascript;base64,' + Buffer.from(validatorSource).toString('base64'));
  const base = 'https://example.supabase.co/storage/v1/object/public/graphic-backgrounds/';
  assert.equal(validateBackground('football', null, base), null);
  assert.throws(() => validateBackground('unknown', null, base));
  assert.throws(() => validateBackground('football', { brightness: 999, saturation: 100, shadow: 50 }, base));
  assert.throws(() => validateBackground('football', { brightness: 100, saturation: 100, shadow: 50, imageUrl: 'https://evil.example/image.png' }, base));
  assert.throws(() => validateBackground('football', { brightness: 100, saturation: 100, shadow: 50, imageUrl: base + 'volleyball/a.png' }, base));
  const browser = await chromium.launch();
  let settings = {}, uploads = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/\/graphic-backgrounds(?:\?|\/upload|$)/, async route => {
      const req = route.request(), url = new URL(req.url()), sport = url.searchParams.get('sport');
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' } });
      let data = { settings };
      if (req.method() === 'POST') {
        assert.equal(req.headers()['x-rpi-admin-secret'], 'test-only');
        if (url.pathname.endsWith('/upload')) { uploads++; data = { imageUrl: url.origin + '/data/graphic-backgrounds/' + sport + '/test.png' }; }
        else { settings[sport] = req.postDataJSON().settings; data = { settings: settings[sport] }; }
      }
      await route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } });
    });
    const source = fs.readFileSync('playoff_board.js', 'utf8');
    await page.route('**/playoff_board.js*', route => route.fulfill({ contentType: 'text/javascript', body: source.replace('function renderPlayoffPicture(', 'window.bgTest={renderPlayoffPicture,buildServerExportHtml_}; function renderPlayoffPicture(') }));
    await page.goto('http://localhost:8124/playoff_board.html');
    await page.waitForFunction(() => window.GraphicBackgrounds && window.bgTest);
    await page.evaluate(async () => {
      await window.GraphicBackgrounds.ready;
      const rows = Array.from({ length: 12 }, (_, i) => ({ school: 'School ' + i, regionRank: i + 1, record: '3-0-0', rpi: '.65432' }));
      window.bgTest.renderPlayoffPicture({ west: rows, east: rows, total: 24, excludedTeams: [] }, 'Class 1A', 'Football');
      await window.GraphicBackgrounds.open({ secret: 'test-only', sport: 'football', html: window.bgTest.buildServerExportHtml_() });
    });
    await page.locator('[data-setting=brightness]').fill('125');
    assert.equal(await page.locator('.sports-graphic').getAttribute('data-custom-background'), null, 'Draft must not publish');
    await page.locator('[data-save]').click();
    await page.getByRole('status').filter({ hasText: 'Football saved.' }).waitFor();
    assert.equal(settings.football.brightness, 125);
    assert.equal(await page.locator('.sports-graphic').getAttribute('data-custom-background'), 'true');
    const html = await page.evaluate(() => window.bgTest.buildServerExportHtml_());
    assert.ok(html.includes('--bg-brightness: 1.25'));
    assert.ok(!html.includes('class="background-editor"'));
    await page.locator('[data-sport]').selectOption('volleyball');
    await page.locator('[data-upload]').setInputFiles('sports-court.png');
    await page.getByRole('status').filter({ hasText: 'Upload ready' }).waitFor();
    assert.equal(uploads, 0);
    await page.locator('[data-save]').click();
    await page.getByRole('status').filter({ hasText: 'Volleyball saved.' }).waitFor();
    assert.equal(uploads, 1);
    await page.locator('[data-reset]').click();
    assert.ok(settings.volleyball.imageUrl, 'Reset is draft until Save');
    await page.locator('[data-save]').click();
    await page.getByRole('status').filter({ hasText: 'Volleyball saved.' }).waitFor();
    assert.equal(settings.volleyball, null);
    assert.equal(settings.football.brightness, 125);
    await page.screenshot({ path: 'style-previews/background-admin.png' });
    assert.deepEqual(errors, []);
    console.log('Passed: preview isolation, save, per-sport upload/reset, export snapshot, no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
