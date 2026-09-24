const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const source = fs.readFileSync('playoff_board.js', 'utf8');
    await page.route('**/playoff_board.js*', route => route.fulfill({ contentType: 'text/javascript', body: source.replace('function renderPlayoffPicture(', 'window.polishTest = { renderPlayoffPicture, renderRegionRows, buildServerExportHtml_ }; function renderPlayoffPicture(') }));
    await page.goto('http://localhost:8124/playoff_board.html');
    await page.waitForFunction(() => window.polishTest);
    for (const kind of ['playoff', 'standings']) {
      const html = await page.evaluate(kind => {
        const rows = Array.from({ length: 24 }, (_, i) => ({ school: `School ${i + 1}`, regionRank: i + 1, rank: i + 1, record: '3-1-0', rpi: '0.65432', logoUrl: '/NCHSAALOGO.png' }));
        const data = { west: rows, east: rows, total: 48, excludedTeams: [] };
        const api = window.polishTest;
        (kind === 'playoff' ? api.renderPlayoffPicture : api.renderRegionRows)(data, 'Class 3A', 'Football');
        return api.buildServerExportHtml_();
      }, kind);
      const preview = await browser.newPage({ viewport: { width: 1600, height: 2200 }, deviceScaleFactor: 2 });
      if (kind === 'playoff' && process.argv.includes('--backgrounds')) fs.writeFileSync('style-previews/background-board.html', html);
      await preview.setContent(html, { waitUntil: 'networkidle' });
      const board = preview.locator('.sports-graphic');
      console.log(kind, await board.boundingBox());
      if (kind === 'playoff') assert.equal(await preview.locator('.graphic-vs').first().evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)');
      await board.screenshot({ path: `style-previews/${kind}-polish.png` });
      if (kind === 'playoff' && process.argv.includes('--backgrounds')) {
        for (const surface of ['turf', 'court']) {
          await board.evaluate((node, surface) => { node.dataset.surface = surface; }, surface);
          await board.screenshot({ path: `style-previews/${surface}-original.png` });
          const brighter = await preview.addStyleTag({ content: `
            body .sports-graphic { background: linear-gradient(90deg, #03080585, #050b07ad 50%, #03080585), url('http://localhost:8124/sports-turf.png') center / 600px 600px repeat !important; }
            body .sports-graphic[data-surface="court"] { background: linear-gradient(90deg, #080b0c52, #080b0c78 50%, #080b0c52), url('http://localhost:8124/sports-court.png') center / cover no-repeat !important; }
          ` });
          await board.screenshot({ path: `style-previews/${surface}-brighter.png` });
          await brighter.evaluate(node => node.remove());
        }
      }
      await preview.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
