const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cheerio = require('cheerio');

const source = fs.readFileSync('server-headless-export-v2.js', 'utf8');
const context = vm.createContext({ cheerio, URL, console,
  decodeHtmlEntities: value => cheerio.load(`<span>${value}</span>`)('span').text()
});
vm.runInContext(source.slice(source.indexOf('function cleanScheduleText('),
  source.indexOf('async function fetchMaxPrepsTeamRecord(')), context);
const frontend = fs.readFileSync('playoff_board.js', 'utf8');
vm.runInContext(frontend.slice(frontend.indexOf('function maxPrepsPathWithSeason_('),
  frontend.indexOf('const MAXPREPS_URL_CACHE_KEY_')), context);

const data = { props: { pageProps: { teamContext: {
  data: { schoolName: 'Test School', year: '2025' },
  standingsData: { overallStanding: { overallWinLossTies: '10-2' } }
}, contests: [] } } };
for (const attributes of [
  'id="__NEXT_DATA__" type="application/json"',
  'id="__NEXT_DATA__" type="application/json" crossorigin="anonymous"',
  "crossorigin='anonymous' type='application/json' id='__NEXT_DATA__'"
]) {
  const html = `<script ${attributes}>${JSON.stringify(data)}</script>`;
  assert.equal(context.parseMaxPrepsScheduleHtml(html, 'https://www.maxpreps.com/').team.year, '2025');
  assert.equal(context.parseMaxPrepsTeamRecordHtml(html), '10-2');
}
assert.throws(() => context.parseMaxPrepsScheduleHtml('<html></html>', ''), /not found/);
assert.equal(context.parseMaxPrepsTeamRecordHtml('<html></html>'), '');
assert.equal(context.maxPrepsPathWithSeason_('/nc/team/football/25-26/schedule/', ''), '/nc/team/football');
assert.equal(context.maxPrepsPathWithSeason_('/nc/team/football/25-26/schedule/', '23-24'), '/nc/team/football/23-24');
assert.equal(context.maxPrepsPathWithSeason_('/nc/team/football/schedule/', '24-25'), '/nc/team/football/24-25');
console.log('Parser and season URL regression tests passed.');

if (process.argv.includes('--live')) {
  (async () => {
    for (const path of ['football/schedule/', 'football/25-26/schedule/', 'football/24-25/schedule/', 'soccer/25-26/schedule/']) {
      const url = `https://www.maxpreps.com/nc/new-london/north-stanly-comets/${path}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200);
      const html = await response.text();
      const schedule = context.parseMaxPrepsScheduleHtml(html, url);
      assert.ok(schedule.games.length > 0);
      assert.equal(schedule.team.name, 'North Stanly');
      console.log(JSON.stringify({ path, year: schedule.team.year, games: schedule.games.length, record: schedule.team.record }));
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
