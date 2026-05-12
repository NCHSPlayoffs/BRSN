const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');
const cheerio = require('cheerio');

const PORT = Number(process.env.PORT || 8000);
const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'rpi-snapshots.json');
const SNAPSHOT_SWEEP_INTERVAL_MS = Number(process.env.RPI_SNAPSHOT_INTERVAL_MS || 60 * 60 * 1000);
const SNAPSHOT_SWEEP_INITIAL_DELAY_MS = Number(process.env.RPI_SNAPSHOT_INITIAL_DELAY_MS || 20 * 1000);
const SNAPSHOT_REQUEST_DELAY_MS = Number(process.env.RPI_SNAPSHOT_REQUEST_DELAY_MS || 450);
const LOCAL_SNAPSHOTS_ENABLED = process.env.RPI_LOCAL_SNAPSHOTS === '1';
const SNAPSHOT_SWEEP_ENABLED = LOCAL_SNAPSHOTS_ENABLED && process.env.RPI_SNAPSHOT_SWEEP !== '0';
const RPI_TEST_MODE = process.env.RPI_TEST_MODE === '1';
const MAXPREPS_SCHEDULE_CACHE_MS = Number(process.env.MAXPREPS_SCHEDULE_CACHE_MS || 15 * 60 * 1000);
const MAXPREPS_OPPONENT_RECORD_CACHE_MS = Number(process.env.MAXPREPS_OPPONENT_RECORD_CACHE_MS || 30 * 60 * 1000);
const MAXPREPS_OPPONENT_RECORD_CONCURRENCY = Number(process.env.MAXPREPS_OPPONENT_RECORD_CONCURRENCY || 4);
const BRACKET_NCHSAA_BASE = 'https://www.nchsaa.org';
const BRACKET_MAXPREPS_BASE = 'https://www.maxpreps.com';
const BRACKET_DEFAULT_WIDTH = '3000';
const BRACKET_COMPACT_WIDTH = '2300';
const BRACKET_DEFAULT_HEIGHT = '1100';
const fullBracketCache = new Map();
const RPI_CLASSES = [
  'Class 1A', 'Class 2A', 'Class 3A', 'Class 4A',
  'Class 5A', 'Class 6A', 'Class 7A', 'Class 8A'
];
const RPI_SPORTS = [
  { label: 'Football', key: 'football', kind: 'single_table', url: 'https://www.nchsaa.org/sports/football/' },
  { label: 'Baseball', key: 'baseball', kind: 'single_table', url: 'https://www.nchsaa.org/sports/baseball/' },
  { label: 'Softball', key: 'softball', kind: 'single_table', url: 'https://www.nchsaa.org/sports/softball/' },
  { label: 'Volleyball', key: 'volleyball', kind: 'single_table', url: 'https://www.nchsaa.org/sports/volleyball/' },
  { label: 'Boys Basketball', key: 'boys', kind: 'basketball', url: 'https://www.nchsaa.org/sports/basketball/' },
  { label: 'Girls Basketball', key: 'girls', kind: 'basketball', url: 'https://www.nchsaa.org/sports/basketball/' },
  { label: 'Girls Soccer', key: 'girls_soccer', kind: 'single_table', url: 'https://www.nchsaa.org/sports/womens-soccer/' },
  { label: 'Boys Soccer', key: 'boys_soccer', kind: 'single_table', url: 'https://www.nchsaa.org/sports/mens-soccer/' }
];
const BASKETBALL_ANCHOR_GIRLS = '<h3>Girls Basketball RPI standings</h3>';
const BASKETBALL_ANCHOR_BOYS = '<h3>Boys Basketball RPI standings</h3>';
let browserPromise = null;
let snapshotSweepTimer = null;
let snapshotSweepRunning = false;
let snapshotSweepLastRun = null;
let snapshotSweepLastStats = null;
const maxPrepsScheduleCache = new Map();
const maxPrepsOpponentRecordCache = new Map();

function send(res, status, body, type = 'text/plain') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), 'application/json');
}

function sendHtml(res, status, html) {
  send(res, status, html, 'text/html; charset=utf-8');
}

function contentTypeForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const rel = clean === '/' ? '/playoff_board.html' : clean;
  const full = path.join(ROOT, rel);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function compileTeamNameNormalizeConfig(raw = {}) {
  return {
    phraseReplacements: (Array.isArray(raw.phraseReplacements) ? raw.phraseReplacements : [])
      .map(rule => ({
        from: new RegExp(String(rule.pattern || ''), String(rule.flags || 'g')),
        to: String(rule.to || '')
      }))
      .filter(rule => rule.from.source),
    removePhrases: Array.isArray(raw.removePhrases) ? raw.removePhrases : [],
    removeTokens: Array.isArray(raw.removeTokens) ? raw.removeTokens : [],
    removeTrailingSchool: raw.removeTrailingSchool !== false,
    removeLeadingThe: raw.removeLeadingThe !== false,
    acronymOverrides: raw.acronymOverrides || {}
  };
}

const TEAM_NAME_NORMALIZE = compileTeamNameNormalizeConfig(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'supabase', 'functions', '_shared', 'team-name-normalize.config.json'), 'utf8'))
);

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function acronymKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyAcronymOverrides(name, cfg = TEAM_NAME_NORMALIZE) {
  const map = cfg?.acronymOverrides || null;
  if (!map) return name;
  const key = acronymKey(name);
  return map[key] || name;
}

function normalizeTeamKey(name, cfg = TEAM_NAME_NORMALIZE) {
  let s = String(name || '');
  s = applyAcronymOverrides(s, cfg);
  s = s
    .replace(/\u00A0/g, ' ')
    .replace(/[â€™â€˜]/g, "'")
    .replace(/[â€“â€”]/g, '-')
    .replace(/\u00E2\u20AC\u2122|\u00E2\u20AC\u02DC/g, "'")
    .replace(/\u00E2\u20AC\u201C|\u00E2\u20AC\u201D/g, '-');
  for (const rule of (cfg.phraseReplacements || [])) s = s.replace(rule.from, rule.to);
  if (cfg.removeLeadingThe) s = s.replace(/^\s*the\b\s+/i, '');
  s = s.replace(/[^A-Za-z0-9 ]+/g, ' ');
  for (const phrase of (cfg.removePhrases || [])) {
    const re = new RegExp(`\\b${escapeRegex(phrase).replace(/\s+/g, '\\s+')}\\b`, 'ig');
    s = s.replace(re, ' ');
  }
  for (const token of (cfg.removeTokens || [])) {
    const re = new RegExp(`\\b${escapeRegex(token)}\\b`, 'ig');
    s = s.replace(re, ' ');
  }
  if (cfg.removeTrailingSchool) s = s.replace(/\bschool\b\s*$/i, '');
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function normalizeSnapshotRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const school = String(row.school || row.team || '').trim();
      const rank = Number(row.rank || index + 1);
      const rpi = Number.parseFloat(String(row.rpi || '').replace(/[^\d.-]/g, ''));
      return {
        teamKey: normalizeTeamKey(school || row.teamKey || ''),
        school,
        rank: Number.isFinite(rank) ? rank : index + 1,
        rpi: Number.isFinite(rpi) ? rpi : null,
        record: String(row.record || ''),
        wp: String(row.wp || ''),
        mwp: String(row.mwp || ''),
        owp: String(row.owp || ''),
        oowp: String(row.oowp || '')
      };
    })
    .filter(row => row.teamKey && row.school && row.rpi !== null);
}

function snapshotHash(rows) {
  const stableRows = rows.map(row => [
    row.teamKey, row.rank, row.rpi, row.record, row.wp, row.mwp, row.owp, row.oowp
  ]);
  return crypto.createHash('sha256').update(JSON.stringify(stableRows)).digest('hex');
}

function rpiSnapshotDelta(newer, older) {
  if (!older || older.rpi === null || newer.rpi === null) return null;
  const delta = Number((Number(newer.rpi) - Number(older.rpi)).toFixed(6));
  return Number.isFinite(delta) ? delta : null;
}

function rankSnapshotDelta(newer, older) {
  if (!older) return null;
  const olderRank = Number(older.rank);
  const newerRank = Number(newer.rank);
  if (!Number.isFinite(olderRank) || !Number.isFinite(newerRank)) return null;
  return olderRank - newerRank;
}

function computeLastSnapshotChanges(rows, snapshots) {
  const mapCache = new Map();
  const mapForSnapshot = snapshot => {
    if (!mapCache.has(snapshot)) {
      mapCache.set(snapshot, new Map((snapshot.rows || []).map(row => [row.teamKey, row])));
    }
    return mapCache.get(snapshot);
  };

  return rows.map(row => {
    let newer = row;
    let lastRankChange = null;
    let lastRpiChange = null;

    for (const snapshot of snapshots) {
      const older = mapForSnapshot(snapshot).get(row.teamKey) || null;
      if (!older) continue;

      if (lastRankChange === null) {
        const rankChange = rankSnapshotDelta(newer, older);
        if (Number.isFinite(rankChange) && rankChange !== 0) lastRankChange = rankChange;
      }

      if (lastRpiChange === null) {
        const rpiChange = rpiSnapshotDelta(newer, older);
        if (Number.isFinite(rpiChange) && rpiChange !== 0) lastRpiChange = rpiChange;
      }

      if (lastRankChange !== null && lastRpiChange !== null) break;
      newer = older;
    }

    return {
      teamKey: row.teamKey,
      lastRankChange,
      lastRpiChange
    };
  });
}

function numericRpi(value) {
  const n = Number.parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function readSnapshotStore() {
  try {
    const raw = fs.readFileSync(SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const snapshots = Array.isArray(parsed.snapshots) ? parsed.snapshots : [];
    return {
      snapshots: snapshots.map(snapshot => ({
        ...snapshot,
        rows: normalizeSnapshotRows(snapshot.rows || [])
      }))
    };
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('Snapshot store read failed:', err.message);
    return { snapshots: [] };
  }
}

function writeSnapshotStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(store, null, 2));
}

function compareSnapshots(payload) {
  const sport = String(payload.sport || '').trim();
  const classification = String(payload.classification || '').trim();
  const source = String(payload.source || 'official').trim();
  const seasonYear = String(payload.seasonYear || 'live').trim();
  const rows = normalizeSnapshotRows(payload.rows);
  const shouldSave = LOCAL_SNAPSHOTS_ENABLED && payload.save !== false;
  const compareSnapshotId = String(payload.compareSnapshotId || '').trim();
  const includeLastChange = payload.includeLastChange === true || payload.includeLastChange === 'true';
  if (!sport || !classification || !rows.length) throw new Error('Missing sport, classification, or rows');

  const now = new Date().toISOString();
  const rowHash = snapshotHash(rows);
  const store = readSnapshotStore();
  const matching = store.snapshots
    .filter(snapshot =>
      snapshot.sport === sport &&
      snapshot.classification === classification &&
      snapshot.seasonYear === seasonYear &&
      snapshot.source === source
    )
    .sort((a, b) => String(b.fetchedAt).localeCompare(String(a.fetchedAt)));

  const latest = matching[0] || null;
  const selectedPrevious = compareSnapshotId
    ? matching.find(snapshot => snapshot.id === compareSnapshotId) || null
    : null;
  const previous = selectedPrevious || matching.find(snapshot => snapshot.rowHash !== rowHash) || null;
  let saved = false;

  if (shouldSave && (!latest || latest.rowHash !== rowHash)) {
    store.snapshots.push({
      id: crypto.randomUUID(),
      sport,
      classification,
      seasonYear,
      source,
      fetchedAt: now,
      rowHash,
      rows
    });
    const keep = new Set();
    store.snapshots
      .filter(snapshot =>
        snapshot.sport === sport &&
        snapshot.classification === classification &&
        snapshot.seasonYear === seasonYear &&
        snapshot.source === source
      )
      .sort((a, b) => String(b.fetchedAt).localeCompare(String(a.fetchedAt)))
      .slice(0, 80)
      .forEach(snapshot => keep.add(snapshot.id));
    store.snapshots = store.snapshots.filter(snapshot =>
      !(snapshot.sport === sport &&
        snapshot.classification === classification &&
        snapshot.seasonYear === seasonYear &&
        snapshot.source === source) ||
      keep.has(snapshot.id)
    );
    writeSnapshotStore(store);
    saved = true;
  }

  const previousByKey = new Map((previous?.rows || []).map(row => [row.teamKey, row]));
  const lastChangeByKey = includeLastChange
    ? new Map(computeLastSnapshotChanges(rows, matching).map(row => [row.teamKey, row]))
    : new Map();
  const comparedRows = rows.map(row => {
    const old = previousByKey.get(row.teamKey) || null;
    const rpiChange = old && old.rpi !== null && row.rpi !== null
      ? Number((row.rpi - old.rpi).toFixed(6))
      : null;
    const lastChange = lastChangeByKey.get(row.teamKey) || {};
    return {
      teamKey: row.teamKey,
      previousRank: old?.rank ?? null,
      rankChange: old ? old.rank - row.rank : null,
      lastRankChange: lastChange.lastRankChange ?? null,
      previousRpi: old?.rpi ?? null,
      rpiChange,
      lastRpiChange: lastChange.lastRpiChange ?? null,
      isNew: !old
    };
  });

  return {
    saved,
    saveEnabled: shouldSave,
    canCompare: Boolean(previous),
    includeLastChange,
    compareSnapshotId: previous?.id || '',
    fetchedAt: saved ? now : latest?.fetchedAt || now,
    previousFetchedAt: previous?.fetchedAt || '',
    rowHash,
    rows: comparedRows
  };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch().then(browser => {
      browser.on('disconnected', () => {
        browserPromise = null;
      });
      return browser;
    }).catch(err => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

async function renderPNG(payload) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width: 1800, height: 1200 },
    deviceScaleFactor: 2
  });

  try {
    page.setDefaultTimeout(15000);
    await page.setContent(payload.html, { waitUntil: 'domcontentloaded' });

    await page.evaluate(async () => {
      if (!document.fonts || !document.fonts.ready) return;
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);
    });

    const el = await page.$(payload.selector);
    if (!el) throw new Error("Selector not found");

    await el.evaluate(async node => {
      const imgs = Array.from(node.querySelectorAll('img'));
      await Promise.all(imgs.map(img => {
        img.loading = 'eager';
        if (img.complete) return;
        return new Promise(resolve => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          img.onload = finish;
          img.onerror = finish;
          setTimeout(finish, 3500);
        });
      }));
    });

    await page.evaluate(() => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));

    return await el.screenshot({ type: 'png', animations: 'disabled' });
  } finally {
    await page.close().catch(() => {});
  }
}

async function fetchRemotePage(payload) {
  const targetUrl = String(payload.url || '').trim();
  if (!/^https?:\/\//i.test(targetUrl)) throw new Error('Only http/https URLs can be fetched');

  const options = payload.options && typeof payload.options === 'object' ? payload.options : {};
  const method = String(options.method || 'GET').toUpperCase();
  const headers = options.headers && typeof options.headers === 'object' ? options.headers : {};
  const fetchOptions = {
    method,
    headers
  };

  if (method !== 'GET' && method !== 'HEAD' && options.body != null) {
    fetchOptions.body = String(options.body);
  }

  const response = await fetch(targetUrl, fetchOptions);
  const text = await response.text();
  if (!response.ok) throw new Error(`Remote fetch failed (${response.status}) for ${targetUrl}`);
  return text;
}

function maxPrepsHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };
}

function bracketCleanSegment(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function bracketClassSegment(value) {
  const match = String(value || '').trim().match(/(\d+)a/i);
  return match ? `${match[1]}a` : bracketCleanSegment(value || '3a');
}

function bracketSportSegment(value) {
  const key = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const map = {
    football: 'football',
    baseball: 'baseball',
    softball: 'softball',
    volleyball: 'volleyball',
    'girls soccer': 'womens-soccer',
    'boys soccer': 'mens-soccer',
    'girls basketball': 'womens-basketball',
    'boys basketball': 'mens-basketball',
    wrestling: 'wrestling'
  };
  return map[key] || bracketCleanSegment(value || 'baseball');
}

function bracketYearSegment(value, sportLabel) {
  const raw = String(value || '').trim();
  const sportKey = String(sportLabel || '').trim().toLowerCase();
  if (!raw || raw.toLowerCase() === 'live') {
    const now = new Date();
    const current = now.getFullYear();
    const fallSports = new Set(['football', 'volleyball', 'boys soccer', 'boys-soccer', 'mens-soccer']);
    return String(fallSports.has(sportKey) && now.getMonth() < 7 ? current - 1 : current);
  }
  const season = raw.match(/^(\d{4})-(\d{2})$/);
  if (season) {
    const start = Number(season[1]);
    const endShort = Number(season[2]);
    const end = Math.floor(start / 100) * 100 + endShort;
    const fallSports = new Set(['football', 'volleyball', 'boys soccer', 'boys-soccer', 'mens-soccer']);
    return String(fallSports.has(sportKey) ? start : end);
  }
  const year = raw.match(/\d{4}/);
  return year ? year[0] : String(new Date().getFullYear());
}

function bracketWidgetWidth(classification) {
  return classification === '1a' || classification === '8a' ? BRACKET_COMPACT_WIDTH : BRACKET_DEFAULT_WIDTH;
}

function bracketDecodeEntities(value) {
  return String(value || '').replace(/&amp;/g, '&');
}

function bracketNormalizeDimension(value, fallback) {
  if (!value || value === '100%') return fallback;
  const match = String(value).match(/\d+/);
  return match ? match[0] : fallback;
}

function bracketShouldAbsolutize(value) {
  return !value.startsWith('#') && !value.startsWith('mailto:') && !value.startsWith('javascript:');
}

function bracketAbsolutizeAttributes($, root, baseUrl) {
  const urlAttrs = ['href', 'src', 'action', 'data-hover-card', 'data-lazy-image'];
  root.find('*').addBack().each((_, element) => {
    const node = $(element);
    for (const attr of urlAttrs) {
      const value = node.attr(attr);
      if (value && bracketShouldAbsolutize(value)) {
        node.attr(attr, new URL(value, baseUrl).toString());
      }
    }

    const srcset = node.attr('srcset');
    if (srcset) {
      node.attr(
        'srcset',
        srcset
          .split(',')
          .map(part => {
            const pieces = part.trim().split(/\s+/);
            if (pieces[0] && bracketShouldAbsolutize(pieces[0])) {
              pieces[0] = new URL(pieces[0], baseUrl).toString();
            }
            return pieces.join(' ');
          })
          .join(', ')
      );
    }
  });
}

async function bracketFetchText(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; BRSN bracket customizer/0.1)',
      accept: 'text/html,application/xhtml+xml'
    }
  });
  if (!response.ok) {
    const error = new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
    error.status = response.status === 404 ? 404 : 502;
    throw error;
  }
  return response.text();
}

async function discoverFullBracketWidgetUrl(nchsaaUrl, widgetWidth = BRACKET_DEFAULT_WIDTH) {
  const html = await bracketFetchText(nchsaaUrl);
  const $ = cheerio.load(html);
  const link = $('a.maxpreps-widget-link').first();
  if (!link.length) {
    const error = new Error(`No MaxPreps widget link found on ${nchsaaUrl}`);
    error.status = 404;
    throw error;
  }

  const href = bracketDecodeEntities(link.attr('href') || '');
  const sourceUrl = new URL(href, BRACKET_MAXPREPS_BASE);
  const widgetUrl = new URL('/widgets/tournament.aspx', BRACKET_MAXPREPS_BASE);
  for (const [key, value] of sourceUrl.searchParams) {
    widgetUrl.searchParams.set(key, value);
  }
  widgetUrl.searchParams.set('width', widgetWidth);
  widgetUrl.searchParams.set('height', bracketNormalizeDimension(link.attr('data-height'), BRACKET_DEFAULT_HEIGHT));
  widgetUrl.searchParams.set('allow-scrollbar', link.attr('data-allow-scrollbar') || 'true');
  return widgetUrl.toString();
}

async function loadFullBracket({ year, classification, sport }) {
  const safeYear = bracketCleanSegment(year || new Date().getFullYear());
  const safeClass = bracketClassSegment(classification || '3a');
  const safeSport = bracketSportSegment(sport || 'baseball');
  const nchsaaUrl = `${BRACKET_NCHSAA_BASE}/bracket/${safeYear}-${safeClass}-${safeSport}-bracket/`;
  const cached = fullBracketCache.get(nchsaaUrl);
  if (cached && Date.now() - cached.createdAt < 5 * 60 * 1000) return cached.payload;

  const widgetWidth = bracketWidgetWidth(safeClass);
  const widgetUrl = await discoverFullBracketWidgetUrl(nchsaaUrl, widgetWidth);
  const payload = await extractFullBracketWidget(widgetUrl, nchsaaUrl, widgetWidth);
  fullBracketCache.set(nchsaaUrl, { createdAt: Date.now(), payload });
  return payload;
}

async function extractFullBracketWidget(widgetUrl, sourcePageUrl, canvasWidth = BRACKET_DEFAULT_WIDTH) {
  const html = await bracketFetchText(widgetUrl);
  const $ = cheerio.load(html, { decodeEntities: false });
  const form = $('#widget_form').first();
  if (!form.length) {
    const error = new Error('MaxPreps response did not include #widget_form.');
    error.status = 502;
    throw error;
  }

  bracketAbsolutizeAttributes($, form, widgetUrl);
  form.find('script[src*="plugins.compressed"]').remove();
  form.find('script').each((_, script) => {
    const text = $(script).html() || '';
    if (text.includes('mpPrivacy') || text.includes('branch.init')) $(script).remove();
  });
  normalizeFullBracketByeMatchups($, form);
  enhanceFullBracketMascotImages($, form);
  swapFullBracketSides($, form);
  annotateFullBracketForStyling($, form);
  form.find('.matchup-footer').remove();
  ensureFullBracketChampionshipRoundHeaders($, form);
  form.find('.round > .center').remove();
  form.find('.bracket-header').remove();
  form.find('.bracket-logo, .brsn-nchsaa-logo, .brsn-top-branding, .brsn-top-logo').remove();

  const styles = [];
  $('head link[rel="stylesheet"], head style').each((_, element) => {
    const node = $(element).clone();
    bracketAbsolutizeAttributes($, node, widgetUrl);
    styles.push($.html(node));
  });

  const title = ($('title').first().text() || 'NCHSAA Bracket').trim();
  return {
    title,
    sourcePageUrl,
    widgetUrl,
    canvasWidth,
    styles: styles.join('\n'),
    html: $.html(form)
  };
}

function ensureFullBracketChampionshipRoundHeaders($, form) {
  form.find('[data-view-type="horizontal-championship-view"]').each((_, view) => {
    $(view).find('.round').each((index, round) => {
      const label = index === 0 ? 'Regional' : 'State';
      let header = $(round).find('> .round-header').first();
      if (!header.length) {
        $(round).prepend('<div class="round-header"></div>');
        header = $(round).find('> .round-header').first();
      }
      header.html(`<div class="content"><div class="center"><span class="round-label">${bracketEscapeHtml(label)}</span></div></div>`);
    });
  });
}

function swapFullBracketSides($, form) {
  form.find('.view[data-view-type="horizontal-view"]').each((_, view) => {
    const containers = $(view).find('> .rounds');
    if (containers.length !== 2) return;
    const c0 = $(containers[0]);
    const c1 = $(containers[1]);
    const rounds0 = c0.find('> .round').get();
    const rounds1 = c1.find('> .round').get();
    c0.empty();
    c1.empty();
    rounds1.forEach(round => c0.append(round));
    rounds0.forEach(round => c1.append(round));
  });
}

function annotateFullBracketForStyling($, form) {
  form.find('.bracket-container').addClass('brsn-bracket');
  const matchupLabels = new Map();

  form.find('.view[data-view-type="horizontal-view"]').each((_, view) => {
    const rounds = $(view).find('> .rounds > .round');
    const middle = Math.ceil(rounds.length / 2);
    const gameCounts = { west: 0, east: 0 };
    $(view).addClass(`brsn-round-count-${middle}`);

    rounds.each((index, round) => {
      const sideClass = index < middle ? 'brsn-west' : 'brsn-east';
      const roundDepth = index < middle ? index : index - middle;
      $(round).addClass(sideClass);
      annotateFullBracketRoundHeader($, $(round), roundDepth);
      $(round).find('.matchup-container').addClass(sideClass).each((_, matchup) => {
        const side = sideClass === 'brsn-west' ? 'west' : 'east';
        gameCounts[side] += 1;
        annotateFullBracketMatchupHeader($, $(matchup), side, gameCounts[side], matchupLabels);
      });
    });

    const quadrants = $(view).find('.quadrant');
    const labels = quadrants.map((_, quadrant) => $(quadrant).text().trim()).get();
    const repeated = labels.length === 4 && new Set(labels).size === 1;
    quadrants.each((index, quadrant) => {
      const isWest = index < 2;
      $(quadrant).addClass(isWest ? 'brsn-west' : 'brsn-east');
      if (repeated) $(quadrant).text(isWest ? 'West' : 'East');
    });
  });

  form.find('[data-view-type="horizontal-championship-view"]').each((_, view) => {
    $(view).addClass('brsn-finals');
    $(view).find('.round').first().find('.matchup-container').each((index, matchup) => {
      const side = index === 0 ? 'east' : 'west';
      $(matchup).addClass(side === 'west' ? 'brsn-west' : 'brsn-east');
      annotateFullBracketPlaceholderNames($, $(matchup), matchupLabels);
      annotateFullBracketMatchupHeader($, $(matchup), side, 1, matchupLabels, { forceLeftToRight: true });
    });
    $(view).find('.round').last().find('.matchup-container').each((_, matchup) => {
      $(matchup).addClass('brsn-championship');
      annotateFullBracketPlaceholderNames($, $(matchup), matchupLabels);
      annotateFullBracketMatchupHeader($, $(matchup), 'championship', 1, matchupLabels, { forceLeftToRight: true });
    });
  });

  annotateFullBracketPlaceholderNames($, form, matchupLabels);
}

function annotateFullBracketRoundHeader($, round, roundDepth) {
  const labels = ['First Round', 'Second Round', 'Third Round', 'Quarterfinals', 'Semifinals', 'Final'];
  const label = labels[roundDepth] || `Round ${roundDepth + 1}`;
  const date = extractFullBracketRoundDate($, round);
  let header = round.find('> .round-header .center').first();
  if (!header.length) {
    const roundHeader = round.find('> .round-header').first();
    if (roundHeader.length) {
      roundHeader.empty();
      roundHeader.append('<div class="center"></div>');
      header = roundHeader.find('.center').first();
    }
  }
  if (header.length) {
    const dateMarkup = date ? `<span class="round-date">${bracketEscapeHtml(date)}</span>` : '';
    header.html(`<span class="round-label">${bracketEscapeHtml(label)}</span>${dateMarkup}`);
  }
}

function extractFullBracketRoundDate($, round) {
  let dateText = '';
  round.find("a[href*='/games/']").each((_, anchor) => {
    const href = $(anchor).attr('href') || '';
    const match = href.match(/\/games\/(\d{1,2})-(\d{1,2})-\d{4}\//);
    if (match) {
      dateText = formatFullBracketRoundDate(Number(match[1]), Number(match[2]));
      return false;
    }
    return undefined;
  });
  return dateText;
}

function formatFullBracketRoundDate(month, day) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[month - 1] || ''} ${day}${getFullBracketOrdinalSuffix(day)}`.trim();
}

function getFullBracketOrdinalSuffix(day) {
  if (day >= 11 && day <= 13) return 'th';
  const lastDigit = day % 10;
  if (lastDigit === 1) return 'st';
  if (lastDigit === 2) return 'nd';
  if (lastDigit === 3) return 'rd';
  return 'th';
}

function normalizeFullBracketByeMatchups($, form) {
  form.find('.matchup-container.is-bye').each((_, matchup) => {
    const teams = $(matchup).find('.team');
    const byeResult = teams.find('.result').filter((__, result) => $(result).text().trim().toLowerCase() === 'bye').first();
    const teamWithBye = byeResult.closest('.team');
    const emptyOpponent = teams.filter((__, team) => {
      const name = $(team).find('.name').text().trim();
      const seed = $(team).find('.seed').text().trim();
      return !name && !seed;
    }).first();
    if (!teamWithBye.length || !emptyOpponent.length) return;
    byeResult.remove();
    emptyOpponent.addClass('brsn-bye-team');
    emptyOpponent.find('.name').remove();
    emptyOpponent.find('.seed').remove();
    emptyOpponent.find('.mascotimage').remove();
    emptyOpponent.append('<span class="seed"></span><span class="mascotimage brsn-empty-logo"></span><span class="name">BYE</span>');
  });
}

function enhanceFullBracketMascotImages($, form) {
  form.find('.mascotimage img').each((_, image) => {
    const node = $(image);
    const src = node.attr('src');
    if (!src) return;
    try {
      const url = new URL(src);
      url.searchParams.set('width', '96');
      url.searchParams.set('fit', 'bounds');
      node.attr('src', url.toString());
      node.attr('width', '40');
      node.attr('height', '40');
    } catch {
      // Leave uncommon image URLs untouched.
    }
  });
}

function annotateFullBracketMatchupHeader($, matchup, side, gameNumber, matchupLabels, options = {}) {
  const matchupBox = matchup.find('> .matchup').first();
  if (!matchupBox.length) return;
  const existingHeader = matchupBox.find('> .contest-header').first();
  const label = `${formatFullBracketSide(side)} - Game ${gameNumber}`;
  const status = getFullBracketMatchupStatus($, matchup);
  const mirrorHeader = side === 'east' && !options.forceLeftToRight;
  const headerContent = mirrorHeader
    ? `<span class="game-status">${bracketEscapeHtml(status)}</span><span class="game-number">${bracketEscapeHtml(label)}</span>`
    : `<span class="game-number">${bracketEscapeHtml(label)}</span><span class="game-status">${bracketEscapeHtml(status)}</span>`;
  const headerHtml = `<header class="contest-header brsn-game-header">${headerContent}</header>`;
  rememberFullBracketMatchupLabel($, matchup, label, matchupLabels);
  matchup.find('> .matchup-header').remove();
  if (existingHeader.length) existingHeader.replaceWith(headerHtml);
  else matchupBox.prepend(headerHtml);
}

function rememberFullBracketMatchupLabel($, matchup, label, matchupLabels) {
  if (!matchupLabels) return;
  const matchupId = normalizeFullBracketMatchupId(matchup.attr('id'));
  if (matchupId) matchupLabels.set(matchupId, label);
  const originalGame = matchup.find('> .matchup > .contest-header .game-number').first().text().trim();
  const gameMatch = originalGame.match(/^G\s*(\d+)$/i);
  if (gameMatch) matchupLabels.set(`G${gameMatch[1]}`, label);
}

function annotateFullBracketPlaceholderNames($, matchup, matchupLabels) {
  matchup.find('.team .name').each((_, name) => {
    const node = $(name);
    const text = node.text().trim();
    const winnerMatch = text.match(/^Winner\s+G\s*(\d+)$/i);
    if (!winnerMatch) return;
    const sourceId = normalizeFullBracketMatchupId(node.closest('.team').attr('data-source-matchup-id'));
    const mappedLabel = (sourceId && matchupLabels.get(sourceId)) || matchupLabels.get(`G${winnerMatch[1]}`);
    if (mappedLabel) node.text(`${mappedLabel} Winner`);
  });
}

function normalizeFullBracketMatchupId(value) {
  return String(value || '').trim().replace(/^matchup_/i, '');
}

function getFullBracketMatchupStatus($, matchup) {
  if (matchup.hasClass('is-bye')) return 'Bye';
  const resultText = matchup.find('.result').text().trim().toLowerCase();
  if (resultText.includes('bye')) return 'Bye';
  if (matchup.hasClass('has-result') || resultText.length > 0) return 'Final';
  return getFullBracketScheduledStatus($, matchup) || 'TBD';
}

function getFullBracketScheduledStatus($, matchup) {
  const abbrText = matchup.find('> .matchup > .contest-header abbr').first().text().trim();
  if (abbrText) return normalizeFullBracketScheduledText(abbrText);
  const datedHref = matchup
    .find("a[href*='/games/']")
    .map((_, link) => $(link).attr('href') || '')
    .get()
    .find(href => /\/games\/\d{1,2}-\d{1,2}-\d{4}\//.test(href));
  if (!datedHref) return '';
  const match = datedHref.match(/\/games\/(\d{1,2})-(\d{1,2})-\d{4}\//);
  return match ? `${Number(match[1])}/${Number(match[2])}` : '';
}

function normalizeFullBracketScheduledText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b(\d{1,2})p\b/gi, '$1PM')
    .replace(/\b(\d{1,2})a\b/gi, '$1AM');
}

function formatFullBracketSide(side) {
  if (side === 'west') return 'West';
  if (side === 'east') return 'East';
  return 'State';
}

function bracketEscapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeMaxPrepsInputUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('Missing MaxPreps URL');

  const url = new URL(raw, 'https://www.maxpreps.com');
  if (!/maxpreps\.com$/i.test(url.hostname)) {
    throw new Error('Only MaxPreps URLs can be used for schedules');
  }

  url.protocol = 'https:';
  url.hash = '';
  return url;
}

function normalizeMaxPrepsScheduleUrl(input) {
  const url = normalizeMaxPrepsInputUrl(input);
  url.search = '';

  let pathname = url.pathname.replace(/\/+$/g, '');
  if (!/\/schedule$/i.test(pathname)) pathname += '/schedule';
  url.pathname = `${pathname}/`;
  return url.toString();
}

async function resolveMaxPrepsScheduleUrl(input) {
  const inputUrl = normalizeMaxPrepsInputUrl(input);
  if (!/\/local\/team\/home\.aspx$/i.test(inputUrl.pathname)) {
    return normalizeMaxPrepsScheduleUrl(inputUrl.toString());
  }

  const response = await fetch(inputUrl.toString(), { headers: maxPrepsHeaders() });
  const finalUrl = response.url || inputUrl.toString();
  await response.text().catch(() => '');
  if (!response.ok) throw new Error(`MaxPreps team link failed (${response.status})`);
  return normalizeMaxPrepsScheduleUrl(finalUrl);
}

function cleanScheduleText(value) {
  return decodeHtmlEntities(String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim());
}

function maxPrepsTeamFromArray(value) {
  if (!Array.isArray(value)) return null;
  return {
    id: cleanScheduleText(value[1]),
    name: cleanScheduleText(value[14] || value[19]),
    city: cleanScheduleText(value[15]),
    state: cleanScheduleText(value[16]),
    formattedName: cleanScheduleText(value[19] || value[14]),
    logoUrl: cleanScheduleText(value[20]),
    mascot: cleanScheduleText(value[21]),
    url: cleanScheduleText(value[13]),
    resultText: cleanScheduleText(value[3]),
    outcome: cleanScheduleText(value[5]),
    score: Number.isFinite(Number(value[6])) ? Number(value[6]) : null,
    locationCode: Number.isFinite(Number(value[11])) ? Number(value[11]) : null
  };
}

function maxPrepsLocationLabel(code) {
  if (code === 0) return 'Home';
  if (code === 1) return 'Away';
  if (code === 2) return 'Neutral';
  return '';
}

function maxPrepsStatusClass(outcome, statusText, dateIso) {
  const outcomeLower = String(outcome || '').toLowerCase();
  const statusLower = String(statusText || '').toLowerCase();
  if (outcomeLower === 'w') return 'win';
  if (outcomeLower === 'l') return 'loss';
  if (outcomeLower === 't') return 'tie';
  if (statusLower.includes('postpon')) return 'postponed';
  if (statusLower.includes('cancel')) return 'cancelled';
  const gameTime = Date.parse(dateIso);
  if (Number.isFinite(gameTime) && gameTime > Date.now()) return 'scheduled';
  return 'final';
}

function maxPrepsScoreText(subject, opponent) {
  if (subject?.resultText) return subject.resultText;
  if (subject?.score !== null && opponent?.score !== null) return `${subject.score}-${opponent.score}`;
  return '';
}

function parseMaxPrepsScheduleHtml(html, scheduleUrl) {
  const match = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('MaxPreps schedule data was not found');

  const data = JSON.parse(decodeHtmlEntities(match[1]));
  const pageProps = data?.props?.pageProps || {};
  const teamContext = pageProps.teamContext || {};
  const teamData = teamContext.data || {};
  const overallStanding = teamContext.standingsData?.overallStanding || {};
  const teamId = cleanScheduleText(teamData.teamId);
  const contests = Array.isArray(pageProps.contests) ? pageProps.contests : [];

  const games = contests
    .map(contest => {
      if (!Array.isArray(contest)) return null;
      const statusText = cleanScheduleText(contest[28]);
      if (/deleted/i.test(statusText)) return null;
      if (/invalid\s+dual\s+teams|multi\s+teams/i.test(statusText)) return null;

      const teamCandidates = [contest[37], contest[38]]
        .map(maxPrepsTeamFromArray)
        .filter(Boolean);
      const fallbackTeams = Array.isArray(contest[0])
        ? contest[0].map(maxPrepsTeamFromArray).filter(Boolean)
        : [];
      const teams = teamCandidates.length >= 2 ? teamCandidates : fallbackTeams;
      if (!teams.length) return null;

      const subject = teams.find(team => team.id && team.id === teamId)
        || teams.find(team => team.url && teamData.canonicalUrl && team.url === teamData.canonicalUrl)
        || teams[0];
      const opponent = teams.find(team => team !== subject) || teams[1] || null;
      if (!opponent?.name) return null;
      const dateIso = cleanScheduleText(contest[11] || contest[2]);
      const gameUrl = cleanScheduleText(contest[18]);
      const summary = cleanScheduleText(contest[29]);
      const scoreText = maxPrepsScoreText(subject, opponent);
      const outcome = cleanScheduleText(subject?.outcome);

      return {
        date: dateIso,
        location: maxPrepsLocationLabel(subject?.locationCode),
        opponent: opponent ? {
          name: opponent.name,
          formattedName: opponent.formattedName,
          city: opponent.city,
          state: opponent.state,
          mascot: opponent.mascot,
          logoUrl: opponent.logoUrl,
          url: opponent.url
        } : null,
        result: outcome,
        score: scoreText,
        status: statusText || (scoreText ? 'Final' : 'Scheduled'),
        statusClass: maxPrepsStatusClass(outcome, statusText, dateIso),
        summary,
        gameUrl
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const at = Date.parse(a.date);
      const bt = Date.parse(b.date);
      if (Number.isFinite(at) && Number.isFinite(bt)) return at - bt;
      return 0;
    });

  return {
    source: 'maxpreps',
    url: scheduleUrl,
    fetchedAt: new Date().toISOString(),
    updatedOn: cleanScheduleText(teamContext.teamSettings?.scheduleUpdatedOn),
    pageTitle: cleanScheduleText(pageProps.pageTitle || ''),
    team: {
      id: teamId,
      name: cleanScheduleText(teamData.schoolName || ''),
      formattedName: cleanScheduleText(teamData.schoolFormattedName || teamData.schoolName || ''),
      mascot: cleanScheduleText(teamData.schoolMascot || ''),
      logoUrl: cleanScheduleText(teamData.schoolMascotUrl || ''),
      city: cleanScheduleText(teamData.schoolCity || ''),
      state: cleanScheduleText(teamData.stateCode || ''),
      sport: cleanScheduleText(teamData.formattedSportSeasonName || teamData.sport || ''),
      season: cleanScheduleText(teamData.season || ''),
      year: cleanScheduleText(teamData.year || ''),
      record: cleanScheduleText(overallStanding.overallWinLossTies || ''),
      league: cleanScheduleText(teamData.leagueName || ''),
      division: cleanScheduleText(teamData.stateDivisionName || '')
    },
    games
  };
}

function parseMaxPrepsTeamRecordHtml(html) {
  const match = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) return '';
  try {
    const data = JSON.parse(decodeHtmlEntities(match[1]));
    return cleanScheduleText(data?.props?.pageProps?.teamContext?.standingsData?.overallStanding?.overallWinLossTies || '');
  } catch (_) {
    return '';
  }
}

async function fetchMaxPrepsTeamRecord(teamUrl) {
  const normalized = normalizeMaxPrepsInputUrl(teamUrl);
  normalized.hash = '';
  normalized.search = '';
  const cacheKey = normalized.toString();
  const cached = maxPrepsOpponentRecordCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < MAXPREPS_OPPONENT_RECORD_CACHE_MS) return cached.record;

  try {
    const html = await fetchRemotePage({
      url: cacheKey,
      options: { headers: maxPrepsHeaders() }
    });
    const record = parseMaxPrepsTeamRecordHtml(html);
    maxPrepsOpponentRecordCache.set(cacheKey, { cachedAt: Date.now(), record });
    return record;
  } catch (err) {
    console.warn(`[MaxPreps] opponent record unavailable for ${cacheKey}: ${err.message}`);
    maxPrepsOpponentRecordCache.set(cacheKey, { cachedAt: Date.now(), record: '' });
    return '';
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await mapper(items[current], current);
    }
  }));
  return results;
}

async function addOpponentRecordsToSchedule(schedule) {
  const games = Array.isArray(schedule?.games) ? schedule.games : [];
  const opponentUrls = [...new Set(games
    .map(game => game?.opponent?.url || '')
    .filter(Boolean))];
  if (!opponentUrls.length) return schedule;

  const pairs = await mapWithConcurrency(opponentUrls, MAXPREPS_OPPONENT_RECORD_CONCURRENCY, async url => {
    const record = await fetchMaxPrepsTeamRecord(url);
    return [url, record];
  });
  const recordByUrl = new Map(pairs);

  games.forEach(game => {
    if (game?.opponent?.url) {
      game.opponent.record = recordByUrl.get(game.opponent.url) || '';
    }
  });
  return schedule;
}

async function fetchMaxPrepsSchedule(inputUrl) {
  const scheduleUrl = await resolveMaxPrepsScheduleUrl(inputUrl);
  const cached = maxPrepsScheduleCache.get(scheduleUrl);
  if (cached && Date.now() - cached.cachedAt < MAXPREPS_SCHEDULE_CACHE_MS) {
    const hasOldOpponentShape = (cached.data?.games || []).some(game =>
      game?.opponent?.url && !Object.prototype.hasOwnProperty.call(game.opponent, 'record')
    );
    if (hasOldOpponentShape) {
      await addOpponentRecordsToSchedule(cached.data);
      cached.cachedAt = Date.now();
    }
    return { ...cached.data, cached: true };
  }

  const html = await fetchRemotePage({
    url: scheduleUrl,
    options: {
      headers: maxPrepsHeaders()
    }
  });

  const data = parseMaxPrepsScheduleHtml(html, scheduleUrl);
  await addOpponentRecordsToSchedule(data);
  maxPrepsScheduleCache.set(scheduleUrl, { cachedAt: Date.now(), data });
  return data;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function textFromHtml(html) {
  return decodeHtmlEntities(String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function extractLastUpdated(html) {
  const text = textFromHtml(html);
  let match = text.match(/Last\s*updated\s*:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}(?:\s*\(\d{1,2}:\d{2}\s*[ap]m\))?)/i);
  if (match?.[1]) return match[1].trim();
  match = text.match(/Last\s*updated\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}:\d{2}\s*[ap]m)?)/i);
  if (match?.[1]) return match[1].trim();
  match = text.match(/Last\s*updated\s*:?\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i);
  return match?.[1]?.trim() || '';
}

function parseRowsFromTableHtml(tableHtml) {
  const rows = [];
  const rowMatches = String(tableHtml || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

  for (const tr of rowMatches) {
    const cells = [];
    const cellMatches = tr.match(/<(?:td|th)\b[\s\S]*?<\/(?:td|th)>/gi) || [];
    for (const cell of cellMatches) {
      cells.push(textFromHtml(cell));
    }

    if (cells.length < 6) continue;
    const joined = cells.join(' ').toLowerCase();
    if (joined.includes('team') && joined.includes('record') && joined.includes('wp') && joined.includes('owp') && joined.includes('oowp') && joined.includes('rpi')) continue;
    if (joined.includes('select a classification')) continue;

    const hasRankCol = cells.length >= 7 && /^\d+$/.test(String(cells[0] || '').trim());
    const row = {
      team: hasRankCol ? cells[1] : cells[0],
      record: hasRankCol ? (cells[2] || '') : (cells[1] || ''),
      wp: hasRankCol ? (cells[3] || '') : (cells[2] || ''),
      owp: hasRankCol ? (cells[4] || '') : (cells[3] || ''),
      oowp: hasRankCol ? (cells[5] || '') : (cells[4] || ''),
      rpi: hasRankCol ? (cells[6] || '') : (cells[5] || '')
    };
    if (row.team) rows.push(row);
  }

  return rows;
}

async function fetchOfficialSingleTable(sport, classification) {
  const division = classification.replace(/^Class/i, 'Division').trim();
  const postBody = new URLSearchParams({ classification: division }).toString();
  let html = '';

  try {
    html = await fetchRemotePage({
      url: sport.url,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: postBody
      }
    });
  } catch (err) {
    html = await fetchRemotePage({ url: sport.url });
  }

  const start = html.indexOf('<table');
  const end = html.indexOf('</table>', start);
  if (start === -1 || end === -1) throw new Error('No standings table found');

  return {
    rows: parseRowsFromTableHtml(html.slice(start, end + 8)),
    lastUpdated: extractLastUpdated(html)
  };
}

async function fetchOfficialBasketballTable(sport, classification) {
  const division = classification.replace(/^Class/i, 'Division').trim();
  const payload = sport.key === 'girls'
    ? new URLSearchParams({ classification: '', classification_2: division }).toString()
    : new URLSearchParams({ classification: division }).toString();
  const html = await fetchRemotePage({
    url: sport.url,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    }
  });
  const anchor = sport.key === 'girls' ? BASKETBALL_ANCHOR_GIRLS : BASKETBALL_ANCHOR_BOYS;
  const anchorIndex = html.indexOf(anchor);
  if (anchorIndex === -1) throw new Error('Basketball standings anchor not found');

  const start = html.indexOf('<table', anchorIndex);
  const end = html.indexOf('</table>', start);
  if (start === -1 || end === -1) throw new Error('No basketball standings table found');

  return {
    rows: parseRowsFromTableHtml(html.slice(start, end + 8)),
    lastUpdated: extractLastUpdated(html)
  };
}

async function fetchOfficialRpiRows(sport, classification) {
  const result = sport.kind === 'basketball'
    ? await fetchOfficialBasketballTable(sport, classification)
    : await fetchOfficialSingleTable(sport, classification);
  if (!result.rows.length) throw new Error(`No live ${sport.label} ${classification} RPI rows found`);
  return result;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureServerSnapshot(sport, classification) {
  const result = await fetchOfficialRpiRows(sport, classification);
  const compare = compareSnapshots({
    sport: sport.label,
    classification,
    source: 'official',
    seasonYear: 'live',
    save: true,
    rows: result.rows.map((row, index) => ({
      school: row.team,
      rank: index + 1,
      rpi: row.rpi,
      record: row.record,
      wp: row.wp,
      owp: row.owp,
      oowp: row.oowp
    }))
  });

  return {
    saved: Boolean(compare.saved),
    rowCount: result.rows.length,
    lastUpdated: result.lastUpdated,
    fetchedAt: compare.fetchedAt
  };
}

function findSnapshotSport(value) {
  const needle = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return RPI_SPORTS.find(sport => {
    const label = sport.label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const key = sport.key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    return needle === label || needle === key;
  }) || null;
}

function snapshotLocalDate(fetchedAt, tzOffsetMinutes) {
  const time = Date.parse(fetchedAt);
  if (!Number.isFinite(time)) return '';
  const offset = Number.isFinite(Number(tzOffsetMinutes)) ? Number(tzOffsetMinutes) : 0;
  return new Date(time - offset * 60000).toISOString().slice(0, 10);
}

function snapshotSummary(snapshot) {
  return {
    id: snapshot.id,
    sport: snapshot.sport,
    classification: snapshot.classification,
    seasonYear: snapshot.seasonYear,
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
    rowHash: snapshot.rowHash,
    rowCount: Array.isArray(snapshot.rows) ? snapshot.rows.length : 0,
    testMode: Boolean(snapshot.testMode)
  };
}

function listSnapshots({ sport, classification, date, tzOffset }) {
  const store = readSnapshotStore();
  return store.snapshots
    .filter(snapshot =>
      (!sport || snapshot.sport === sport) &&
      (!classification || snapshot.classification === classification) &&
      (!date || snapshotLocalDate(snapshot.fetchedAt, tzOffset) === date)
    )
    .sort((a, b) => String(b.fetchedAt).localeCompare(String(a.fetchedAt)))
    .map(snapshotSummary);
}

function getSnapshotById(id) {
  const snapshotId = String(id || '').trim();
  if (!snapshotId) return null;
  return readSnapshotStore().snapshots.find(snapshot => snapshot.id === snapshotId) || null;
}

function splitTeamAliases(value) {
  return String(value || '')
    .split('||')
    .map(item => item.trim())
    .filter(Boolean);
}

function uniqueTeamLogStrings(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(value => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function buildTeamSnapshotLog({ sport, classification, seasonYear, source, school, schoolAliases = [], limit = 80 }) {
  const candidates = uniqueTeamLogStrings([school, ...schoolAliases]);
  const teamKeys = new Set(candidates.map(item => normalizeTeamKey(item)).filter(Boolean));
  const teamKey = [...teamKeys][0] || '';
  if (!sport || !classification || !teamKey) throw new Error('Missing sport, classification, or school');

  const snapshots = readSnapshotStore().snapshots
    .filter(snapshot =>
      snapshot.sport === sport &&
      snapshot.classification === classification &&
      snapshot.seasonYear === seasonYear &&
      snapshot.source === source
    )
    .sort((a, b) => String(b.fetchedAt).localeCompare(String(a.fetchedAt)));

  const matchingLogs = snapshots
    .map(snapshot => {
      const row = (snapshot.rows || []).find(item =>
        teamKeys.has(item.teamKey) ||
        teamKeys.has(normalizeTeamKey(item.school))
      ) || null;
      return row ? { snapshot, row } : null;
    })
    .filter(Boolean)
    .slice(0, Math.max(1, Number(limit) || 80));

  const logs = matchingLogs.map((entry, index) => {
    const older = matchingLogs[index + 1]?.row || null;
    return {
      snapshotId: entry.snapshot.id,
      fetchedAt: entry.snapshot.fetchedAt,
      school: entry.row.school,
      rank: entry.row.rank,
      record: entry.row.record || '',
      wp: entry.row.wp || '',
      owp: entry.row.owp || '',
      oowp: entry.row.oowp || '',
      rpi: entry.row.rpi,
      rankChange: older ? rankSnapshotDelta(entry.row, older) : null,
      rpiChange: older ? rpiSnapshotDelta(entry.row, older) : null
    };
  });

  return {
    sport,
    classification,
    seasonYear,
    source,
    school: matchingLogs[0]?.row?.school || String(school || '').trim(),
    logs
  };
}

function adjustedRpi(value, delta) {
  const n = numericRpi(value);
  if (n === null) return value;
  return Math.max(0, Math.min(1, n + delta)).toFixed(6);
}

function makeTestPreviousRows(rows) {
  return rows
    .map((row, index) => {
      if (index === 10) return null;
      const rank = index + 1;
      let previousRank = rank;
      let previousRpi = row.rpi;

      if (index === 0) {
        previousRank = rank + 3;
        previousRpi = adjustedRpi(row.rpi, -0.000019);
      } else if (index === 1) {
        previousRank = rank + 3;
        previousRpi = adjustedRpi(row.rpi, -0.000011);
      } else if (index === 4) {
        previousRank = Math.max(1, rank - 3);
        previousRpi = adjustedRpi(row.rpi, 0.000021);
      } else if (index === 7) {
        previousRank = Math.max(1, rank - 4);
        previousRpi = adjustedRpi(row.rpi, 0.000015);
      }

      return {
        school: row.team,
        rank: previousRank,
        rpi: previousRpi,
        record: row.record,
        wp: row.wp,
        owp: row.owp,
        oowp: row.oowp
      };
    })
    .filter(Boolean);
}

async function createTestChangeSnapshot(sport, classification) {
  const result = await fetchOfficialRpiRows(sport, classification);
  const rows = normalizeSnapshotRows(makeTestPreviousRows(result.rows));
  if (!rows.length) throw new Error('No rows available for test snapshot');

  const now = new Date().toISOString();
  const store = readSnapshotStore();
  const snapshot = {
    id: crypto.randomUUID(),
    sport: sport.label,
    classification,
    seasonYear: 'live',
    source: 'official',
    testMode: true,
    fetchedAt: now,
    rowHash: snapshotHash(rows),
    rows
  };

  store.snapshots.push(snapshot);
  writeSnapshotStore(store);

  return {
    sport: sport.label,
    classification,
    fetchedAt: now,
    rowCount: rows.length,
    message: `Test change snapshot created for ${classification} ${sport.label}. Load that live board to see fake ▲/▼ changes.`
  };
}

async function runSnapshotSweep(reason = 'hourly') {
  if (!LOCAL_SNAPSHOTS_ENABLED) return;
  if (snapshotSweepRunning) return;
  snapshotSweepRunning = true;
  const stats = { checked: 0, saved: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: '' };
  snapshotSweepLastRun = stats.startedAt;
  console.log(`[RPI snapshots] ${reason} sweep started at ${new Date(stats.startedAt).toLocaleString()}`);

  try {
    for (const sport of RPI_SPORTS) {
      for (const classification of RPI_CLASSES) {
        try {
          const result = await captureServerSnapshot(sport, classification);
          stats.checked += 1;
          if (result.saved) stats.saved += 1;
          console.log(`[RPI snapshots] ${sport.label} ${classification}: ${result.saved ? 'saved new snapshot' : 'no change'} (${result.rowCount} teams)`);
        } catch (err) {
          stats.failed += 1;
          console.warn(`[RPI snapshots] ${sport.label} ${classification} failed: ${err.message}`);
        }
        await delay(SNAPSHOT_REQUEST_DELAY_MS);
      }
    }
  } finally {
    stats.finishedAt = new Date().toISOString();
    snapshotSweepLastStats = stats;
    snapshotSweepRunning = false;
    console.log(`[RPI snapshots] ${reason} sweep finished. Checked ${stats.checked}, saved ${stats.saved}, failed ${stats.failed}.`);
  }
}

function startSnapshotSweeper() {
  if (!SNAPSHOT_SWEEP_ENABLED || snapshotSweepTimer) return;
  setTimeout(() => runSnapshotSweep('startup').catch(err => {
    snapshotSweepRunning = false;
    console.warn('[RPI snapshots] startup sweep failed:', err);
  }), SNAPSHOT_SWEEP_INITIAL_DELAY_MS);
  snapshotSweepTimer = setInterval(() => {
    runSnapshotSweep('hourly').catch(err => {
      snapshotSweepRunning = false;
      console.warn('[RPI snapshots] hourly sweep failed:', err);
    });
  }, SNAPSHOT_SWEEP_INTERVAL_MS);
}

async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } finally {
    browserPromise = null;
  }
}

process.on('SIGINT', async () => {
  if (snapshotSweepTimer) clearInterval(snapshotSweepTimer);
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (snapshotSweepTimer) clearInterval(snapshotSweepTimer);
  await closeBrowser();
  process.exit(0);
});

const server = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    // PNG EXPORT
    if (req.method === 'POST' && req.url === '/export-image') {
      const body = JSON.parse(await readBody(req));
      const png = await renderPNG(body);

      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(png);
    }

    // LOCAL PAGE FETCH PROXY
    if (req.method === 'POST' && req.url === '/fetch-page') {
      const body = JSON.parse(await readBody(req));
      const html = await fetchRemotePage(body);
      return send(res, 200, html, 'text/html; charset=utf-8');
    }

    // MAXPREPS SCHEDULE FETCH + PARSE
    if (req.method === 'GET' && requestUrl.pathname === '/team-schedule') {
      const url = requestUrl.searchParams.get('url') || '';
      const schedule = await fetchMaxPrepsSchedule(url);
      return sendJson(res, 200, schedule);
    }

    // FULL NCHSAA/MAXPREPS PLAYOFF BRACKET FETCH + PARSE
    if (req.method === 'GET' && requestUrl.pathname === '/full-bracket') {
      const sportLabel = requestUrl.searchParams.get('sport') || 'Baseball';
      const classification = requestUrl.searchParams.get('classification') || requestUrl.searchParams.get('class') || 'Class 3A';
      const seasonYear = requestUrl.searchParams.get('seasonYear') || requestUrl.searchParams.get('year') || 'live';
      const bracketYear = bracketYearSegment(seasonYear, sportLabel);
      const payload = await loadFullBracket({
        year: bracketYear,
        classification,
        sport: sportLabel
      });
      return sendJson(res, 200, {
        ...payload,
        bracketYear,
        sport: sportLabel,
        classification
      });
    }

    // LIVE RPI SNAPSHOT COMPARE
    if (req.method === 'GET' && req.url === '/rpi-snapshots/status') {
      return sendJson(res, 200, {
        ok: true,
        localSnapshotsEnabled: LOCAL_SNAPSHOTS_ENABLED,
        testMode: RPI_TEST_MODE,
        sweepEnabled: SNAPSHOT_SWEEP_ENABLED,
        sweepRunning: snapshotSweepRunning,
        intervalMs: SNAPSHOT_SWEEP_INTERVAL_MS,
        lastRun: snapshotSweepLastRun,
        lastStats: snapshotSweepLastStats
      });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/rpi-snapshots/test-change') {
      if (!LOCAL_SNAPSHOTS_ENABLED) {
        return sendHtml(res, 403, `
          <h1>Local Snapshots Are Off</h1>
          <p>This local server is currently running as a PNG export/proxy helper only.</p>
          <p>Restart with <code>RPI_LOCAL_SNAPSHOTS=1</code> if you intentionally want local snapshot testing.</p>
        `);
      }

      if (!RPI_TEST_MODE) {
        return sendHtml(res, 403, `
          <h1>RPI Test Mode Is Off</h1>
          <p>Restart the server with <code>RPI_TEST_MODE=1</code>, then reopen this URL.</p>
          <pre>Stop-Process -Name node
$env:RPI_TEST_MODE="1"
node server-headless-export-v2.js</pre>
        `);
      }

      const sport = findSnapshotSport(requestUrl.searchParams.get('sport'));
      const classification = String(
        requestUrl.searchParams.get('classification') ||
        requestUrl.searchParams.get('class') ||
        ''
      ).trim();
      if (!sport || !RPI_CLASSES.includes(classification)) {
        return sendHtml(res, 400, `
          <h1>Missing Sport Or Class</h1>
          <p>Use a URL like this:</p>
          <p><a href="/rpi-snapshots/test-change?sport=Baseball&classification=Class%203A">/rpi-snapshots/test-change?sport=Baseball&amp;classification=Class%203A</a></p>
        `);
      }

      const result = await createTestChangeSnapshot(sport, classification);
      return sendHtml(res, 200, `
        <h1>Test Snapshot Created</h1>
        <p>${result.message}</p>
        <ul>
          <li>Sport: <strong>${result.sport}</strong></li>
          <li>Class: <strong>${result.classification}</strong></li>
          <li>Rows: <strong>${result.rowCount}</strong></li>
          <li>Created: <strong>${result.fetchedAt}</strong></li>
        </ul>
        <p>Now load <strong>${result.sport}</strong> / <strong>${result.classification}</strong> / <strong>Live</strong> in the app.</p>
      `);
    }

    if (req.method === 'POST' && req.url === '/rpi-snapshots/compare') {
      if (!LOCAL_SNAPSHOTS_ENABLED) {
        return sendJson(res, 503, { error: 'Local snapshots are disabled. Use Supabase for snapshot compare/history.' });
      }
      const body = JSON.parse(await readBody(req));
      return sendJson(res, 200, compareSnapshots(body));
    }

    if (req.method === 'GET' && requestUrl.pathname === '/rpi-snapshots/list') {
      if (!LOCAL_SNAPSHOTS_ENABLED) {
        return sendJson(res, 503, { error: 'Local snapshots are disabled. Use Supabase for snapshot compare/history.' });
      }
      const result = listSnapshots({
        sport: requestUrl.searchParams.get('sport') || '',
        classification: requestUrl.searchParams.get('classification') || '',
        date: requestUrl.searchParams.get('date') || '',
        tzOffset: requestUrl.searchParams.get('tzOffset') || ''
      });
      return sendJson(res, 200, { snapshots: result });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/rpi-snapshots/snapshot') {
      if (!LOCAL_SNAPSHOTS_ENABLED) {
        return sendJson(res, 503, { error: 'Local snapshots are disabled. Use Supabase for snapshot compare/history.' });
      }
      const snapshot = getSnapshotById(requestUrl.searchParams.get('id'));
      if (!snapshot) return sendJson(res, 404, { error: 'Snapshot not found' });
      return sendJson(res, 200, { snapshot });
    }

    if (req.method === 'GET' && requestUrl.pathname === '/rpi-snapshots/team-log') {
      if (!LOCAL_SNAPSHOTS_ENABLED) {
        return sendJson(res, 503, { error: 'Local snapshots are disabled. Use Supabase for team RPI logs.' });
      }
      const sport = String(requestUrl.searchParams.get('sport') || '').trim();
      const classification = String(requestUrl.searchParams.get('classification') || '').trim();
      const seasonYear = String(requestUrl.searchParams.get('seasonYear') || 'live').trim();
      const source = String(requestUrl.searchParams.get('source') || 'official').trim();
      const school = String(requestUrl.searchParams.get('school') || '').trim();
      const schoolAliases = splitTeamAliases(requestUrl.searchParams.get('schoolAliases') || '');
      const limit = Number(requestUrl.searchParams.get('limit') || 80);
      return sendJson(res, 200, buildTeamSnapshotLog({ sport, classification, seasonYear, source, school, schoolAliases, limit }));
    }

    if (req.method === 'POST' && req.url === '/rpi-snapshots/capture') {
      if (!LOCAL_SNAPSHOTS_ENABLED) {
        return sendJson(res, 503, { error: 'Local snapshots are disabled. Use Supabase for snapshot capture.' });
      }
      const body = JSON.parse(await readBody(req));
      const sport = findSnapshotSport(body.sport);
      const classification = String(body.classification || '').trim();
      if (!sport || !RPI_CLASSES.includes(classification)) throw new Error('Missing or invalid sport/classification');
      const result = await captureServerSnapshot(sport, classification);
      return sendJson(res, 200, {
        sport: sport.label,
        classification,
        ...result
      });
    }

    // FILE SERVE
    const file = safePath(req.url);
    if (!file) return send(res, 403, 'Forbidden');

    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      res.writeHead(200, {
        'Content-Type': contentTypeForFile(file),
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });

  } catch (err) {
    console.error(err);
    send(res, 500, err.message);
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Local RPI snapshots: ${LOCAL_SNAPSHOTS_ENABLED ? 'ON' : 'OFF'}${LOCAL_SNAPSHOTS_ENABLED ? '' : ' (Supabase handles snapshots)'}`);
  console.log(`RPI snapshot test mode: ${RPI_TEST_MODE ? 'ON' : 'OFF'}`);
  startSnapshotSweeper();
});
