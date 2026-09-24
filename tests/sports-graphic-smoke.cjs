const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

// Expose renderers only in this intercepted test response, never in the app.
const source = fs.readFileSync(path.join(__dirname, '../playoff_board.js'), 'utf8');
const west = 'North Stanly|Hendersonville|CHASE|Lincolnton|Shelby|Mt Airy|Thomasville|North Wilkes|Union Academy|Walkertown|East Davidson|Pine Lake Prep|West Davidson|Owen|Wheatmore|East Rutherford|Mountain Heritage|West Lincoln|Draughn|Madison|West Wilkes|Polk County|Trinity|East Surry'.split('|');
const east = 'Whiteville|James Kenan|Midway|Martin County|Wallace Rose Hill|Northeastern|Wake Prep Academy|South Columbus|Hertford County|Eastern Randolph|Princeton|Louisburg|South Lenoir|Pasquotank County|Providence Grove|Northwood|Kinston|Greene Central|Pender|North Moore|Goldsboro|McMichael|Farmville Central|Ayden Grifton'.split('|');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
    await page.route('**/playoff_board.js*', route => route.fulfill({ contentType: 'text/javascript', body: source.replace('function renderPlayoffPicture(', 'window.__graphicTest = { renderPlayoffPicture, renderRegionRows, buildRegionPlayoff_, renderPlayoffRegion_, buildServerExportHtml_ };\n    function renderPlayoffPicture(') }));
    await page.goto('http://localhost:8124/playoff_board.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__graphicTest);
    const result = await page.evaluate(({ west, east }) => {
      const rows = names => names.map((school, i) => ({ school, regionRank: i + 1, rank: i + 1, record: '3-1-0', rpi: '0.65432', logoUrl: '/NCHSAALOGO.png', maxPrepsUrl: 'https://www.maxpreps.com/nc/albemarle/north-stanly-comets/football/', longitude: -80 }));
      const data = { west: rows(west), east: rows(east), total: 48, excludedTeams: [] };
      window.__graphicData = data;
      const checks = [];
      for (const count of [6, 12, 13, 16, 17, 24]) {
        const input = data.west.slice(0, count);
        const bracket = window.__graphicTest.buildRegionPlayoff_(input, 'Class 3A', count * 2);
        const host = document.createElement('div');
        host.innerHTML = window.__graphicTest.renderPlayoffRegion_('west', bracket);
        const names = [...host.querySelectorAll('.team-copy-name')].map(n => n.textContent);
        const seedPairs = {
          6: [[6, 3], [5, 4]],
          12: [[12, 5], [11, 6], [10, 7], [9, 8]],
          13: [[13, 4], [12, 5], [11, 6], [10, 7], [9, 8]],
          16: [[16, 1], [15, 2], [14, 3], [13, 4], [12, 5], [11, 6], [10, 7], [9, 8]],
          17: [[17, 16]],
          24: [[24, 9], [23, 10], [22, 11], [21, 12], [20, 13], [19, 14], [18, 15], [17, 16]]
        }[count];
        const expectedPairs = seedPairs.map(([a,b]) => [input[a-1].school, input[b-1].school].join('|')).sort();
        const pairs = [...host.querySelectorAll('.graphic-matchup')].map(n => [...n.querySelectorAll('.team-copy-name')].map(t => t.textContent).join('|')).sort();
        checks.push({ count, unique: new Set(names).size, rendered: names.length, pairsMatch: JSON.stringify(pairs) === JSON.stringify(expectedPairs), byes: host.querySelectorAll('.graphic-bye').length, expectedByes: count - seedPairs.length * 2 });
      }
      window.__graphicTest.renderPlayoffPicture(data, 'Class 3A', 'Football');
      const firstNote = document.querySelector('.graphic-bye .graphic-opponent').textContent;
      if (firstNote !== '(17 VS 16 Winner)') throw new Error(`Incorrect #1 opponent: ${firstNote}`);
      window.__graphicTest.renderPlayoffPicture({ ...data, west: data.west.slice(0,12), east: data.east.slice(0,13), total:25 }, 'Class 1A', 'Football');
      if (document.querySelectorAll('.west .graphic-bye').length !== 4 || document.querySelectorAll('.east .graphic-bye').length !== 3) throw new Error('Uneven field bye regression');
      return checks;
    }, { west, east });
    for (const check of result) {
      assert.equal(check.unique, check.count);
      assert.equal(check.rendered, check.count);
      assert.equal(check.pairsMatch, true);
      assert.equal(check.byes, check.expectedByes);
    }
    console.log('Team coverage and original pairings:', result);
    const noticeStyles = [];
    const exportStyles = [];
    for (const kind of ['playoff', 'standings']) {
      const highlighted = await page.evaluate(kind => {
        const data = window.__graphicData;
        const sample = { ...data, west: data.west.slice(0, 12), east: data.east.slice(0, 13), total: 25 };
        sample.east[12] = { ...sample.east[12], isOddExtra: true, lineRegion: 'East' };
        const api = window.__graphicTest;
        (kind === 'playoff' ? api.renderPlayoffPicture : api.renderRegionRows)(sample, 'Class 1A', 'Football');
        const node = document.querySelector('.sports-graphic tr.odd-extra-east, .sports-graphic .game-box.odd-extra-east');
        return node && getComputedStyle(node).backgroundImage.includes('35, 91, 145');
      }, kind);
      assert.equal(highlighted, true, `${kind} coin-flip team must be highlighted`);
      noticeStyles.push(await page.locator('.sports-graphic .odd-extra-note').evaluate(node => {
        const css = getComputedStyle(node);
        return ['background', 'border', 'boxShadow', 'padding', 'margin', 'font'].map(key => css[key]);
      }));
      assert.equal(await page.locator('.region-rankings-table .odd-extra-note').count(), 0);
    }
    assert.deepEqual(noticeStyles[0], noticeStyles[1], 'Coin-flip notices must match');
    fs.mkdirSync(path.join(__dirname, '../style-previews'), { recursive: true });
    for (const kind of ['playoff', 'standings']) {
      await page.evaluate(kind => {
        const data = window.__graphicData;
        const sample = { ...data, west: data.west.slice(0, 12).map(row => ({ ...row })), east: data.east.slice(0, 13).map(row => ({ ...row })), total: 25 };
        sample.east[10].school = 'SE Collegiate Prep Academy';
        sample.east[8].school = 'North East Carolina Prep';
        sample.west[11].school = 'College Prep and Leadership Academy';
        sample.west[8].school = 'Bonnie Cone Leadership Academy';
        const api = window.__graphicTest;
        (kind === 'playoff' ? api.renderPlayoffPicture : api.renderRegionRows)(sample, 'Class 1A', 'Football');
      }, kind);
      const preview = await browser.newPage({ viewport: { width: 1800, height: 2200 } });
      await preview.setContent(await page.evaluate(() => window.__graphicTest.buildServerExportHtml_()), { waitUntil: 'networkidle' });
      const overflow = await preview.locator('.sports-graphic').evaluate(node => [...node.querySelectorAll('.team-copy-name, .team-name')].filter(name => {
        const box = name.getBoundingClientRect();
        const row = name.closest('.game-box, td').getBoundingClientRect();
        return box.top < row.top || box.bottom > row.bottom || name.scrollWidth > name.clientWidth + 1;
      }).map(name => name.textContent));
      assert.deepEqual(overflow, [], `${kind} long 1A names must fit`);
      if (kind === 'playoff') {
        const tops = await preview.locator('.graphic-games').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
        assert.equal(tops[0], tops[1], 'Unequal bye counts must keep rounds aligned');
        assert.equal(await preview.locator('.sports-graphic .playoff-subtitle').count(), 0);
        assert.equal(await preview.locator('.graphic-vs').count(), 9);
      }
      await preview.locator('.sports-graphic').screenshot({ path: path.join(__dirname, `../style-previews/${kind}-1a.png`) });
      await preview.close();
    }
    for (const kind of ['playoff', 'standings']) {
      await page.evaluate(kind => {
        const api = window.__graphicTest;
        (kind === 'playoff' ? api.renderPlayoffPicture : api.renderRegionRows)(window.__graphicData, 'Class 3A', 'Football');
      }, kind);
      const html = await page.evaluate(() => window.__graphicTest.buildServerExportHtml_());
      const response = await fetch('http://localhost:8124/export-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html, selector: '.sports-graphic', background: '#101513' }) });
      assert.equal(response.status, 200);
      const png = Buffer.from(await response.arrayBuffer());
      assert.equal(png.readUInt32BE(16), 3200);
      assert.equal(png.readUInt32BE(20), 4000);
      fs.writeFileSync(path.join(__dirname, `../style-previews/${kind}-export.png`), png);
      const preview = await browser.newPage({ viewport: { width: 1800, height: 2200 } });
      await preview.setContent(html, { waitUntil: 'networkidle' });
      const board = preview.locator('.sports-graphic');
      const box = await board.boundingBox();
      await board.screenshot({ path: path.join(__dirname, `../style-previews/${kind}-desktop.png`) });
      console.log(kind, await board.evaluate(n => [...n.children].map(c => ({ cls: c.className, height: c.getBoundingClientRect().height }))), box);
      assert.equal(box.width, 1600);
      assert.equal(box.height, 2000);
      exportStyles.push(await board.evaluate(node => ({
        footer: node.querySelector('.graphic-footer').getBoundingClientRect().top,
        gradients: [...node.querySelectorAll('.region-title, .bracket-region-title')].map(n => getComputedStyle(n).backgroundImage)
      })));
      assert.equal(await board.evaluate(node => {
        const footer = node.querySelector('.graphic-footer').getBoundingClientRect();
        return footer.bottom <= node.getBoundingClientRect().bottom;
      }), true, 'Footer must remain within the export');
      if (kind === 'standings') {
        assert.equal(await board.locator('thead, thead tr, th').evaluateAll(nodes => nodes.every(node => {
          const css = getComputedStyle(node);
          return css.backgroundImage === 'none' && css.backgroundColor === 'rgba(0, 0, 0, 0)';
        })), true, 'Column headers must be transparent');
      }
      await board.screenshot({ path: path.join(__dirname, `../style-previews/${kind}-desktop.png`) });
      await preview.close();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('.sports-graphic').screenshot({ path: path.join(__dirname, `../style-previews/${kind}-mobile.png`) });
      const overflow = await page.locator('.sports-graphic').evaluate(node => [...node.querySelectorAll('.team-copy-name, .team-name')].filter(n => {
        const box = n.getBoundingClientRect();
        const row = n.closest('.game-box, td').getBoundingClientRect();
        return n.scrollWidth > n.clientWidth + 1 || box.top < row.top || box.bottom > row.bottom;
      }).map(n => n.textContent));
      assert.deepEqual(overflow, []);
      if (kind === 'standings') assert.equal(await page.locator('.sports-graphic td[data-col="record"]:visible').count(), 48);
      await page.setViewportSize({ width: 1800, height: 1100 });
      console.log(kind, '1600x2000 layout; actual PNG 3200x4000; mobile names fit');
    }
    assert.deepEqual(exportStyles[0], exportStyles[1], 'Export footers and region gradients must match exactly');
    for (const sport of ['Volleyball', 'Boys Basketball', 'Girls Basketball']) {
      await page.evaluate(sport => window.__graphicTest.renderRegionRows(window.__graphicData, 'Class 3A', sport), sport);
      assert.equal(await page.locator('.sports-graphic').getAttribute('data-surface'), 'court');
    }
    const court = await browser.newPage({ viewport: { width: 1800, height: 2200 } });
    await court.setContent(await page.evaluate(() => window.__graphicTest.buildServerExportHtml_()), { waitUntil: 'networkidle' });
    assert.equal(await court.locator('.sports-graphic').evaluate(n => getComputedStyle(n).backgroundImage.includes('sports-court.png')), true);
    await court.locator('.sports-graphic').screenshot({ path: path.join(__dirname, '../style-previews/court-desktop.png') });
    await court.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
