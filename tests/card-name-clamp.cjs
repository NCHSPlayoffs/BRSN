const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<div class="sports-graphic card-playoff-board"><div style="width:150px"><div class="card-playoff-school">An Extremely Long School Name That Would Otherwise Take Many Lines Of Text</div></div></div>');
    await page.addStyleTag({ content: fs.readFileSync('sports-graphic.css', 'utf8') });
    for (const size of ['', 'long', 'xlong']) {
      const result = await page.locator('.card-playoff-school').evaluate((element, size) => {
        element.className = `card-playoff-school ${size}`;
        const style = getComputedStyle(element);
        return { height: element.getBoundingClientRect().height, line: parseFloat(style.lineHeight), clamp: style.webkitLineClamp, clipped: element.scrollHeight > element.clientHeight };
      }, size);
      assert.equal(result.clamp, '2');
      assert.ok(result.height <= result.line * 2 + 1 && result.clipped);
    }
    console.log('Two-line truncation verified for all school-name sizes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
