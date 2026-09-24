const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brsn-background-test-'));
  fs.mkdirSync(path.join(root, 'supabase/functions/_shared'), { recursive: true });
  fs.copyFileSync('supabase/functions/_shared/graphic-backgrounds.js', path.join(root, 'supabase/functions/_shared/graphic-backgrounds.js'));
  const handler = require('../local-backgrounds.cjs')(root);
  const server = http.createServer((req, res) => handler(req, res, new URL(req.url, `http://${req.headers.host}`)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const settings = { brightness: 120, saturation: 100, shadow: 50, imageUrl: '' };
    const save = body => fetch(base + '/graphic-backgrounds?sport=football', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await save({ settings })).status, 200);
    const data = await (await fetch(base + '/graphic-backgrounds')).json();
    assert.deepEqual(data.settings.football, settings);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'data/graphic-backgrounds/settings.json'))).football, settings);
    assert.equal((await fetch(base + '/graphic-backgrounds?sport=football', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' })).status, 403);
    assert.equal((await save({ settings: { ...settings, brightness: 999 } })).status, 400);
    assert.equal((await save({ settings: null })).status, 200);
    console.log('Local save/read, disk persistence, reset, validation, and origin protection passed.');
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
