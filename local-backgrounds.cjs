const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = function localBackgrounds(root) {
  const directory = path.join(root, 'data', 'graphic-backgrounds');
  const configFile = path.join(directory, 'settings.json');
  const validator = import('data:text/javascript;base64,' + Buffer.from(fs.readFileSync(path.join(root, 'supabase/functions/_shared/graphic-backgrounds.js'), 'utf8')).toString('base64'));
  return async (req, res, url) => {
    if (!['/graphic-backgrounds', '/graphic-backgrounds/upload'].includes(url.pathname)) return false;
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); return true; };
    // Local lab only: refuse LAN callers, foreign origins, and cross-site browser requests.
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) ||
        !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
        (req.headers.origin && req.headers.origin !== url.origin) || req.headers['sec-fetch-site'] === 'cross-site') return reply(403, { error: 'Local lab access only' });
    try {
      if (req.method === 'GET' && url.pathname === '/graphic-backgrounds') return reply(200, { settings: fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {} });
      if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
      const { backgroundSports, validateBackground } = await validator;
      const sport = url.searchParams.get('sport');
      if (!Object.hasOwn(backgroundSports, sport)) return reply(400, { error: 'Unknown sport' });
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 5242880) return reply(413, { error: 'Maximum size is 5 MB' });
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      const base = url.origin + '/data/graphic-backgrounds/';
      if (url.pathname.endsWith('/upload')) {
        const png = body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
        const jpeg = body[0] === 255 && body[1] === 216 && body[2] === 255;
        const webp = body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
        const extension = png ? 'png' : jpeg ? 'jpg' : webp ? 'webp' : '';
        if (!extension) return reply(400, { error: 'Use PNG, JPEG, or WebP' });
        const filename = crypto.randomUUID() + '.' + extension;
        fs.mkdirSync(path.join(directory, sport), { recursive: true });
        fs.writeFileSync(path.join(directory, sport, filename), body, { flag: 'wx' });
        return reply(200, { imageUrl: base + sport + '/' + filename });
      }
      const settings = validateBackground(sport, JSON.parse(body.toString()).settings, base);
      const all = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
      all[sport] = settings;
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(configFile + '.tmp', JSON.stringify(all, null, 2));
      fs.renameSync(configFile + '.tmp', configFile);
      return reply(200, { settings });
    } catch (error) { return reply(400, { error: error.message }); }
  };
};
