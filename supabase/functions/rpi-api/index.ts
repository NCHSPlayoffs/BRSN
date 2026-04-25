// deno-lint-ignore-file no-explicit-any

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rpi-cron-secret",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RPI_CRON_SECRET = Deno.env.get("RPI_CRON_SECRET") || "";

const RPI_CLASSES = [
  "Class 1A", "Class 2A", "Class 3A", "Class 4A",
  "Class 5A", "Class 6A", "Class 7A", "Class 8A",
];

const RPI_SPORTS = [
  { label: "Football", key: "football", kind: "single_table", url: "https://www.nchsaa.org/sports/football/" },
  { label: "Baseball", key: "baseball", kind: "single_table", url: "https://www.nchsaa.org/sports/baseball/" },
  { label: "Softball", key: "softball", kind: "single_table", url: "https://www.nchsaa.org/sports/softball/" },
  { label: "Volleyball", key: "volleyball", kind: "single_table", url: "https://www.nchsaa.org/sports/volleyball/" },
  { label: "Boys Basketball", key: "boys", kind: "basketball", url: "https://www.nchsaa.org/sports/basketball/" },
  { label: "Girls Basketball", key: "girls", kind: "basketball", url: "https://www.nchsaa.org/sports/basketball/" },
  { label: "Girls Soccer", key: "girls_soccer", kind: "single_table", url: "https://www.nchsaa.org/sports/womens-soccer/" },
  { label: "Boys Soccer", key: "boys_soccer", kind: "single_table", url: "https://www.nchsaa.org/sports/mens-soccer/" },
];

const BASKETBALL_ANCHOR_GIRLS = "<h3>Girls Basketball RPI standings</h3>";
const BASKETBALL_ANCHOR_BOYS = "<h3>Boys Basketball RPI standings</h3>";

const ALLOWED_FETCH_HOSTS = new Set([
  "nchsaa.org",
  "www.nchsaa.org",
  "docs.google.com",
  "maxpreps.com",
  "www.maxpreps.com",
]);

const maxPrepsScheduleCache = new Map<string, { cachedAt: number; data: any }>();
const maxPrepsOpponentRecordCache = new Map<string, { cachedAt: number; record: string }>();
const MAXPREPS_SCHEDULE_CACHE_MS = Number(Deno.env.get("MAXPREPS_SCHEDULE_CACHE_MS") || 15 * 60 * 1000);
const MAXPREPS_OPPONENT_RECORD_CACHE_MS = Number(Deno.env.get("MAXPREPS_OPPONENT_RECORD_CACHE_MS") || 30 * 60 * 1000);
const MAXPREPS_OPPONENT_RECORD_CONCURRENCY = Number(Deno.env.get("MAXPREPS_OPPONENT_RECORD_CONCURRENCY") || 4);

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function textResponse(value: string, status = 200, contentType = "text/plain; charset=utf-8") {
  return new Response(value, {
    status,
    headers: { ...corsHeaders, "Content-Type": contentType },
  });
}

function routePath(req: Request) {
  const pathname = new URL(req.url).pathname;
  const marker = "/rpi-api";
  const idx = pathname.indexOf(marker);
  return idx >= 0 ? pathname.slice(idx + marker.length) || "/" : pathname;
}

async function readJson(req: Request) {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

function requireDbEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY Edge Function secret");
  }
}

function restHeaders(extra: Record<string, string> = {}) {
  requireDbEnv();
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra,
  };
}

async function restRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: restHeaders(init.headers as Record<string, string> || {}),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase REST failed (${response.status})`);
  return text ? JSON.parse(text) : null;
}

const TEAM_NAME_NORMALIZE = {
  phraseReplacements: [
    { from: /\bsaint\b/ig, to: "St" },
    { from: /\bmount\b/ig, to: "Mt" },
    { from: /\bfort\b/ig, to: "Ft" },
    { from: /\bnorthwest\b/ig, to: "NW" },
    { from: /\bnortheast\b/ig, to: "NE" },
    { from: /\bsouthwest\b/ig, to: "SW" },
    { from: /\bsoutheast\b/ig, to: "SE" },
    { from: /\bpreparatory\b/ig, to: "Prep" },
    { from: /&/g, to: " and " },
    { from: /-/g, to: " " },
  ],
  removePhrases: [
    "high school", "highschool", "junior senior", "middle and high school", "middle and highschool",
    "middle and", "andhigh school", "and Sustainability", "Collegiate and Technical Academy", "of Technology and Arts",
  ],
  removeTokens: ["junior", "senior", "stem", "magnet", "andhighschool"],
  removeTrailingSchool: true,
  removeLeadingThe: true,
  acronymOverrides: {
    "north carolina school of science and mathematics durham": "NCSSM Durham",
    "north carolina school of science and mathematics morganton": "NCSSM Morganton",
  },
};

function escapeRegex(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function acronymKey(name: string) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyAcronymOverrides(name: string, cfg = TEAM_NAME_NORMALIZE) {
  const map = cfg?.acronymOverrides || null;
  if (!map) return name;
  const key = acronymKey(name);
  return map[key as keyof typeof map] || name;
}

function normalizeTeamKey(name: string, cfg = TEAM_NAME_NORMALIZE) {
  let s = String(name || "");
  s = applyAcronymOverrides(s, cfg);
  s = s
    .replace(/\u00A0/g, " ")
    .replace(/[â€™â€˜]/g, "'")
    .replace(/[â€“â€”]/g, "-")
    .replace(/\u00E2\u20AC\u2122|\u00E2\u20AC\u02DC/g, "'")
    .replace(/\u00E2\u20AC\u201C|\u00E2\u20AC\u201D/g, "-");
  for (const rule of (cfg.phraseReplacements || [])) s = s.replace(rule.from, rule.to);
  if (cfg.removeLeadingThe) s = s.replace(/^\s*the\b\s+/i, "");
  s = s.replace(/[^A-Za-z0-9 ]+/g, " ");
  for (const phrase of (cfg.removePhrases || [])) {
    const re = new RegExp(`\\b${escapeRegex(phrase).replace(/\s+/g, "\\s+")}\\b`, "ig");
    s = s.replace(re, " ");
  }
  for (const token of (cfg.removeTokens || [])) {
    const re = new RegExp(`\\b${escapeRegex(token)}\\b`, "ig");
    s = s.replace(re, " ");
  }
  if (cfg.removeTrailingSchool) s = s.replace(/\bschool\b\s*$/i, "");
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeSnapshotRows(rows: any[]) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const school = String(row.school || row.team || "").trim();
      const rank = Number(row.rank || index + 1);
      const rpi = Number.parseFloat(String(row.rpi || "").replace(/[^\d.-]/g, ""));
      return {
        teamKey: normalizeTeamKey(school || row.teamKey || ""),
        school,
        rank: Number.isFinite(rank) ? rank : index + 1,
        rpi: Number.isFinite(rpi) ? rpi : null,
        record: String(row.record || ""),
        wp: String(row.wp || ""),
        mwp: String(row.mwp || ""),
        owp: String(row.owp || ""),
        oowp: String(row.oowp || ""),
      };
    })
    .filter((row) => row.teamKey && row.school && row.rpi !== null);
}

async function snapshotHash(rows: any[]) {
  const stableRows = rows.map((row) => [
    row.teamKey,
    row.rank,
    row.rpi,
    row.record,
    row.wp,
    row.mwp,
    row.owp,
    row.oowp,
  ]);
  const data = new TextEncoder().encode(JSON.stringify(stableRows));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function snapshotFromRecord(record: any) {
  return {
    id: record.id,
    sport: record.sport,
    classification: record.classification,
    seasonYear: record.season_year,
    source: record.source,
    fetchedAt: record.fetched_at,
    rowHash: record.row_hash,
    rows: normalizeSnapshotRows(record.rows || []),
    lastUpdated: record.last_updated || "",
    testMode: Boolean(record.test_mode),
  };
}

async function selectSnapshots(filters: Record<string, string>, limit = 200) {
  const query = new URLSearchParams({ select: "*", order: "fetched_at.desc", limit: String(limit) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, `eq.${value}`);
  });
  const records = await restRequest(`/rpi_snapshots?${query}`);
  return (Array.isArray(records) ? records : []).map(snapshotFromRecord);
}

async function insertSnapshot(snapshot: any) {
  const records = await restRequest("/rpi_snapshots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(snapshot),
  });
  return snapshotFromRecord(Array.isArray(records) ? records[0] : records);
}

function snapshotSummary(snapshot: any) {
  return {
    id: snapshot.id,
    sport: snapshot.sport,
    classification: snapshot.classification,
    seasonYear: snapshot.seasonYear,
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
    rowHash: snapshot.rowHash,
    rowCount: Array.isArray(snapshot.rows) ? snapshot.rows.length : 0,
    testMode: Boolean(snapshot.testMode),
  };
}

function buildTeamSnapshotLog(snapshots: any[], school: string, fallbackSchool = "") {
  const teamKey = normalizeTeamKey(school);
  const matchingLogs = snapshots
    .map((snapshot) => {
      const row = (snapshot.rows || []).find((item: any) =>
        item.teamKey === teamKey ||
        normalizeTeamKey(item.school) === teamKey
      ) || null;
      return row ? { snapshot, row } : null;
    })
    .filter(Boolean) as Array<{ snapshot: any; row: any }>;

  const logs = matchingLogs.map((entry, index) => {
    const older = matchingLogs[index + 1]?.row || null;
    return {
      snapshotId: entry.snapshot.id,
      fetchedAt: entry.snapshot.fetchedAt,
      school: entry.row.school,
      rank: entry.row.rank,
      record: entry.row.record || "",
      wp: entry.row.wp || "",
      owp: entry.row.owp || "",
      oowp: entry.row.oowp || "",
      rpi: entry.row.rpi,
      rankChange: older ? rankSnapshotDelta(entry.row, older) : null,
      rpiChange: older ? rpiSnapshotDelta(entry.row, older) : null,
    };
  });

  return {
    school: matchingLogs[0]?.row?.school || String(fallbackSchool || "").trim(),
    logs,
  };
}

function snapshotLocalDate(fetchedAt: string, tzOffsetMinutes: string) {
  const time = Date.parse(fetchedAt);
  if (!Number.isFinite(time)) return "";
  const offset = Number.isFinite(Number(tzOffsetMinutes)) ? Number(tzOffsetMinutes) : 0;
  return new Date(time - offset * 60000).toISOString().slice(0, 10);
}

function rpiSnapshotDelta(newer: any, older: any) {
  if (!older || older.rpi === null || newer.rpi === null) return null;
  const delta = Number((Number(newer.rpi) - Number(older.rpi)).toFixed(6));
  return Number.isFinite(delta) ? delta : null;
}

function rankSnapshotDelta(newer: any, older: any) {
  if (!older) return null;
  const olderRank = Number(older.rank);
  const newerRank = Number(newer.rank);
  if (!Number.isFinite(olderRank) || !Number.isFinite(newerRank)) return null;
  return olderRank - newerRank;
}

function computeLastSnapshotChanges(rows: any[], snapshots: any[]) {
  const mapCache = new Map<any, Map<string, any>>();
  const mapForSnapshot = (snapshot: any) => {
    if (!mapCache.has(snapshot)) {
      mapCache.set(snapshot, new Map((snapshot.rows || []).map((row: any) => [row.teamKey, row])));
    }
    return mapCache.get(snapshot)!;
  };

  return rows.map((row) => {
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

    return { teamKey: row.teamKey, lastRankChange, lastRpiChange };
  });
}

async function compareSnapshots(payload: any, allowSave = false) {
  const sport = String(payload.sport || "").trim();
  const classification = String(payload.classification || "").trim();
  const source = String(payload.source || "official").trim();
  const seasonYear = String(payload.seasonYear || "live").trim();
  const rows = normalizeSnapshotRows(payload.rows);
  const shouldSave = allowSave && payload.save !== false;
  const compareSnapshotId = String(payload.compareSnapshotId || "").trim();
  const includeLastChange = payload.includeLastChange === true || payload.includeLastChange === "true";
  if (!sport || !classification || !rows.length) throw new Error("Missing sport, classification, or rows");

  const now = new Date().toISOString();
  const rowHash = await snapshotHash(rows);
  const matching = await selectSnapshots({ sport, classification, season_year: seasonYear, source }, 200);

  const latest = matching[0] || null;
  const selectedPrevious = compareSnapshotId
    ? matching.find((snapshot) => snapshot.id === compareSnapshotId) || null
    : null;
  const previous = selectedPrevious || matching.find((snapshot) => snapshot.rowHash !== rowHash) || null;
  let saved = false;
  let fetchedAt = latest?.fetchedAt || now;

  if (shouldSave && (!latest || latest.rowHash !== rowHash)) {
    const inserted = await insertSnapshot({
      sport,
      classification,
      season_year: seasonYear,
      source,
      fetched_at: now,
      row_hash: rowHash,
      rows,
      last_updated: String(payload.lastUpdated || ""),
      test_mode: Boolean(payload.testMode),
    });
    saved = true;
    fetchedAt = inserted.fetchedAt || now;
  }

  const previousByKey = new Map((previous?.rows || []).map((row: any) => [row.teamKey, row]));
  const lastChangeByKey = includeLastChange
    ? new Map(computeLastSnapshotChanges(rows, matching).map((row: any) => [row.teamKey, row]))
    : new Map();
  const comparedRows = rows.map((row) => {
    const old = previousByKey.get(row.teamKey) || null;
    const rpiChange = old && old.rpi !== null && row.rpi !== null
      ? Number((row.rpi - old.rpi).toFixed(6))
      : null;
    const lastChange = lastChangeByKey.get(row.teamKey) as any || {};
    return {
      teamKey: row.teamKey,
      previousRank: old?.rank ?? null,
      rankChange: old ? old.rank - row.rank : null,
      lastRankChange: lastChange.lastRankChange ?? null,
      previousRpi: old?.rpi ?? null,
      rpiChange,
      lastRpiChange: lastChange.lastRpiChange ?? null,
      isNew: !old,
    };
  });

  return {
    saved,
    saveEnabled: shouldSave,
    canCompare: Boolean(previous),
    includeLastChange,
    compareSnapshotId: previous?.id || "",
    fetchedAt,
    previousFetchedAt: previous?.fetchedAt || "",
    rowHash,
    rows: comparedRows,
  };
}

function isAuthorizedMutation(req: Request, url: URL) {
  if (!RPI_CRON_SECRET) return false;
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return auth === RPI_CRON_SECRET ||
    req.headers.get("x-rpi-cron-secret") === RPI_CRON_SECRET ||
    url.searchParams.get("secret") === RPI_CRON_SECRET;
}

function ensureAllowedRemoteUrl(raw: string) {
  const target = new URL(String(raw || "").trim());
  if (!/^https?:$/i.test(target.protocol)) throw new Error("Only http/https URLs can be fetched");
  if (!ALLOWED_FETCH_HOSTS.has(target.hostname.toLowerCase())) {
    throw new Error(`Remote host is not allowed: ${target.hostname}`);
  }
  return target.toString();
}

async function fetchRemotePage(payload: any) {
  const targetUrl = ensureAllowedRemoteUrl(payload.url);
  const options = payload.options && typeof payload.options === "object" ? payload.options : {};
  const method = String(options.method || "GET").toUpperCase();
  if (!["GET", "POST", "HEAD"].includes(method)) throw new Error("Unsupported fetch method");

  const headers = options.headers && typeof options.headers === "object" ? options.headers : {};
  const fetchOptions: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD" && options.body != null) {
    fetchOptions.body = String(options.body);
  }

  const response = await fetch(targetUrl, fetchOptions);
  const text = await response.text();
  if (!response.ok) throw new Error(`Remote fetch failed (${response.status}) for ${targetUrl}`);
  return text;
}

function decodeHtmlEntities(value: string) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function textFromHtml(html: string) {
  return decodeHtmlEntities(String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function extractLastUpdated(html: string) {
  const text = textFromHtml(html);
  let match = text.match(/Last\s*updated\s*:?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4}(?:\s*\(\d{1,2}:\d{2}\s*[ap]m\))?)/i);
  if (match?.[1]) return match[1].trim();
  match = text.match(/Last\s*updated\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s+\d{1,2}:\d{2}\s*[ap]m)?)/i);
  if (match?.[1]) return match[1].trim();
  match = text.match(/Last\s*updated\s*:?\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/i);
  return match?.[1]?.trim() || "";
}

function parseRowsFromTableHtml(tableHtml: string) {
  const rows: any[] = [];
  const rowMatches = String(tableHtml || "").match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

  for (const tr of rowMatches) {
    const cells: string[] = [];
    const cellMatches = tr.match(/<(?:td|th)\b[\s\S]*?<\/(?:td|th)>/gi) || [];
    for (const cell of cellMatches) cells.push(textFromHtml(cell));

    if (cells.length < 6) continue;
    const joined = cells.join(" ").toLowerCase();
    if (joined.includes("team") && joined.includes("record") && joined.includes("wp") && joined.includes("owp") && joined.includes("oowp") && joined.includes("rpi")) continue;
    if (joined.includes("select a classification")) continue;

    const hasRankCol = cells.length >= 7 && /^\d+$/.test(String(cells[0] || "").trim());
    const row = {
      team: hasRankCol ? cells[1] : cells[0],
      record: hasRankCol ? cells[2] || "" : cells[1] || "",
      wp: hasRankCol ? cells[3] || "" : cells[2] || "",
      owp: hasRankCol ? cells[4] || "" : cells[3] || "",
      oowp: hasRankCol ? cells[5] || "" : cells[4] || "",
      rpi: hasRankCol ? cells[6] || "" : cells[5] || "",
    };
    if (row.team) rows.push(row);
  }

  return rows;
}

async function fetchOfficialSingleTable(sport: any, classification: string) {
  const division = classification.replace(/^Class/i, "Division").trim();
  const postBody = new URLSearchParams({ classification: division }).toString();
  let html = "";

  try {
    html = await fetchRemotePage({
      url: sport.url,
      options: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: postBody,
      },
    });
  } catch (_) {
    html = await fetchRemotePage({ url: sport.url });
  }

  const start = html.indexOf("<table");
  const end = html.indexOf("</table>", start);
  if (start === -1 || end === -1) throw new Error("No standings table found");

  return {
    rows: parseRowsFromTableHtml(html.slice(start, end + 8)),
    lastUpdated: extractLastUpdated(html),
  };
}

async function fetchOfficialBasketballTable(sport: any, classification: string) {
  const division = classification.replace(/^Class/i, "Division").trim();
  const payload = sport.key === "girls"
    ? new URLSearchParams({ classification: "", classification_2: division }).toString()
    : new URLSearchParams({ classification: division }).toString();
  const html = await fetchRemotePage({
    url: sport.url,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
    },
  });
  const anchor = sport.key === "girls" ? BASKETBALL_ANCHOR_GIRLS : BASKETBALL_ANCHOR_BOYS;
  const anchorIndex = html.indexOf(anchor);
  if (anchorIndex === -1) throw new Error("Basketball standings anchor not found");

  const start = html.indexOf("<table", anchorIndex);
  const end = html.indexOf("</table>", start);
  if (start === -1 || end === -1) throw new Error("No basketball standings table found");

  return {
    rows: parseRowsFromTableHtml(html.slice(start, end + 8)),
    lastUpdated: extractLastUpdated(html),
  };
}

async function fetchOfficialRpiRows(sport: any, classification: string) {
  const result = sport.kind === "basketball"
    ? await fetchOfficialBasketballTable(sport, classification)
    : await fetchOfficialSingleTable(sport, classification);
  if (!result.rows.length) throw new Error(`No live ${sport.label} ${classification} RPI rows found`);
  return result;
}

function findSnapshotSport(value: string | null) {
  const needle = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return RPI_SPORTS.find((sport) => {
    const label = sport.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const key = sport.key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return needle === label || needle === key;
  }) || null;
}

async function captureSnapshot(sport: any, classification: string) {
  const result = await fetchOfficialRpiRows(sport, classification);
  const compare = await compareSnapshots({
    sport: sport.label,
    classification,
    source: "official",
    seasonYear: "live",
    save: true,
    lastUpdated: result.lastUpdated,
    rows: result.rows.map((row: any, index: number) => ({
      school: row.team,
      rank: index + 1,
      rpi: row.rpi,
      record: row.record,
      wp: row.wp,
      owp: row.owp,
      oowp: row.oowp,
    })),
  }, true);

  return {
    sport: sport.label,
    classification,
    saved: Boolean(compare.saved),
    rowCount: result.rows.length,
    lastUpdated: result.lastUpdated,
    fetchedAt: compare.fetchedAt,
  };
}

function maxPrepsHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };
}

function normalizeMaxPrepsInputUrl(input: string) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("Missing MaxPreps URL");

  const url = new URL(raw, "https://www.maxpreps.com");
  if (!/maxpreps\.com$/i.test(url.hostname)) throw new Error("Only MaxPreps URLs can be used for schedules");
  url.protocol = "https:";
  url.hash = "";
  return url;
}

function normalizeMaxPrepsScheduleUrl(input: string) {
  const url = normalizeMaxPrepsInputUrl(input);
  url.search = "";
  let pathname = url.pathname.replace(/\/+$/g, "");
  if (!/\/schedule$/i.test(pathname)) pathname += "/schedule";
  url.pathname = `${pathname}/`;
  return url.toString();
}

async function resolveMaxPrepsScheduleUrl(input: string) {
  const inputUrl = normalizeMaxPrepsInputUrl(input);
  if (!/\/local\/team\/home\.aspx$/i.test(inputUrl.pathname)) return normalizeMaxPrepsScheduleUrl(inputUrl.toString());

  const response = await fetch(inputUrl.toString(), { headers: maxPrepsHeaders() });
  const finalUrl = response.url || inputUrl.toString();
  await response.text().catch(() => "");
  if (!response.ok) throw new Error(`MaxPreps team link failed (${response.status})`);
  return normalizeMaxPrepsScheduleUrl(finalUrl);
}

function cleanScheduleText(value: unknown) {
  return decodeHtmlEntities(String(value ?? "").replace(/\s+/g, " ").trim());
}

function maxPrepsTeamFromArray(value: any[]) {
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
    locationCode: Number.isFinite(Number(value[11])) ? Number(value[11]) : null,
  };
}

function maxPrepsLocationLabel(code: number) {
  if (code === 0) return "Home";
  if (code === 1) return "Away";
  if (code === 2) return "Neutral";
  return "";
}

function maxPrepsStatusClass(outcome: string, statusText: string, dateIso: string) {
  const outcomeLower = String(outcome || "").toLowerCase();
  const statusLower = String(statusText || "").toLowerCase();
  if (outcomeLower === "w") return "win";
  if (outcomeLower === "l") return "loss";
  if (outcomeLower === "t") return "tie";
  if (statusLower.includes("postpon")) return "postponed";
  if (statusLower.includes("cancel")) return "cancelled";
  const gameTime = Date.parse(dateIso);
  if (Number.isFinite(gameTime) && gameTime > Date.now()) return "scheduled";
  return "final";
}

function maxPrepsScoreText(subject: any, opponent: any) {
  if (subject?.resultText) return subject.resultText;
  if (subject?.score !== null && opponent?.score !== null) return `${subject.score}-${opponent.score}`;
  return "";
}

function parseMaxPrepsScheduleHtml(html: string, scheduleUrl: string) {
  const match = String(html || "").match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error("MaxPreps schedule data was not found");

  const data = JSON.parse(decodeHtmlEntities(match[1]));
  const pageProps = data?.props?.pageProps || {};
  const teamContext = pageProps.teamContext || {};
  const teamData = teamContext.data || {};
  const overallStanding = teamContext.standingsData?.overallStanding || {};
  const teamId = cleanScheduleText(teamData.teamId);
  const contests = Array.isArray(pageProps.contests) ? pageProps.contests : [];

  const games = contests
    .map((contest: any[]) => {
      if (!Array.isArray(contest)) return null;
      const statusText = cleanScheduleText(contest[28]);
      if (/deleted/i.test(statusText)) return null;
      if (/invalid\s+dual\s+teams|multi\s+teams/i.test(statusText)) return null;

      const teamCandidates = [contest[37], contest[38]].map(maxPrepsTeamFromArray).filter(Boolean);
      const fallbackTeams = Array.isArray(contest[0]) ? contest[0].map(maxPrepsTeamFromArray).filter(Boolean) : [];
      const teams = teamCandidates.length >= 2 ? teamCandidates : fallbackTeams;
      if (!teams.length) return null;

      const subject = teams.find((team: any) => team.id && team.id === teamId)
        || teams.find((team: any) => team.url && teamData.canonicalUrl && team.url === teamData.canonicalUrl)
        || teams[0];
      const opponent = teams.find((team: any) => team !== subject) || teams[1] || null;
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
          url: opponent.url,
        } : null,
        result: outcome,
        score: scoreText,
        status: statusText || (scoreText ? "Final" : "Scheduled"),
        statusClass: maxPrepsStatusClass(outcome, statusText, dateIso),
        summary,
        gameUrl,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const at = Date.parse(a.date);
      const bt = Date.parse(b.date);
      if (Number.isFinite(at) && Number.isFinite(bt)) return at - bt;
      return 0;
    });

  return {
    source: "maxpreps",
    url: scheduleUrl,
    fetchedAt: new Date().toISOString(),
    updatedOn: cleanScheduleText(teamContext.teamSettings?.scheduleUpdatedOn),
    pageTitle: cleanScheduleText(pageProps.pageTitle || ""),
    team: {
      id: teamId,
      name: cleanScheduleText(teamData.schoolName || ""),
      formattedName: cleanScheduleText(teamData.schoolFormattedName || teamData.schoolName || ""),
      mascot: cleanScheduleText(teamData.schoolMascot || ""),
      logoUrl: cleanScheduleText(teamData.schoolMascotUrl || ""),
      city: cleanScheduleText(teamData.schoolCity || ""),
      state: cleanScheduleText(teamData.stateCode || ""),
      sport: cleanScheduleText(teamData.formattedSportSeasonName || teamData.sport || ""),
      season: cleanScheduleText(teamData.season || ""),
      year: cleanScheduleText(teamData.year || ""),
      record: cleanScheduleText(overallStanding.overallWinLossTies || ""),
      league: cleanScheduleText(teamData.leagueName || ""),
      division: cleanScheduleText(teamData.stateDivisionName || ""),
    },
    games,
  };
}

function parseMaxPrepsTeamRecordHtml(html: string) {
  const match = String(html || "").match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
  if (!match) return "";
  try {
    const data = JSON.parse(decodeHtmlEntities(match[1]));
    return cleanScheduleText(data?.props?.pageProps?.teamContext?.standingsData?.overallStanding?.overallWinLossTies || "");
  } catch (_) {
    return "";
  }
}

async function fetchMaxPrepsTeamRecord(teamUrl: string) {
  const normalized = normalizeMaxPrepsInputUrl(teamUrl);
  normalized.hash = "";
  normalized.search = "";
  const cacheKey = normalized.toString();
  const cached = maxPrepsOpponentRecordCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < MAXPREPS_OPPONENT_RECORD_CACHE_MS) return cached.record;

  try {
    const html = await fetchRemotePage({ url: cacheKey, options: { headers: maxPrepsHeaders() } });
    const record = parseMaxPrepsTeamRecordHtml(html);
    maxPrepsOpponentRecordCache.set(cacheKey, { cachedAt: Date.now(), record });
    return record;
  } catch (_) {
    maxPrepsOpponentRecordCache.set(cacheKey, { cachedAt: Date.now(), record: "" });
    return "";
  }
}

async function mapWithConcurrency(items: string[], limit: number, mapper: (item: string) => Promise<any>) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(Number(limit) || 1, items.length || 1));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await mapper(items[current]);
    }
  }));
  return results;
}

async function addOpponentRecordsToSchedule(schedule: any) {
  const games = Array.isArray(schedule?.games) ? schedule.games : [];
  const opponentUrls = [...new Set(games.map((game: any) => game?.opponent?.url || "").filter(Boolean))];
  if (!opponentUrls.length) return schedule;

  const pairs = await mapWithConcurrency(opponentUrls, MAXPREPS_OPPONENT_RECORD_CONCURRENCY, async (url) => {
    const record = await fetchMaxPrepsTeamRecord(url);
    return [url, record];
  });
  const recordByUrl = new Map(pairs);
  games.forEach((game: any) => {
    if (game?.opponent?.url) game.opponent.record = recordByUrl.get(game.opponent.url) || "";
  });
  return schedule;
}

async function fetchMaxPrepsSchedule(inputUrl: string) {
  const scheduleUrl = await resolveMaxPrepsScheduleUrl(inputUrl);
  const cached = maxPrepsScheduleCache.get(scheduleUrl);
  if (cached && Date.now() - cached.cachedAt < MAXPREPS_SCHEDULE_CACHE_MS) {
    return { ...cached.data, cached: true };
  }

  const html = await fetchRemotePage({ url: scheduleUrl, options: { headers: maxPrepsHeaders() } });
  const data = parseMaxPrepsScheduleHtml(html, scheduleUrl);
  await addOpponentRecordsToSchedule(data);
  maxPrepsScheduleCache.set(scheduleUrl, { cachedAt: Date.now(), data });
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  const path = routePath(req);

  try {
    if (req.method === "POST" && path === "/fetch-page") {
      const body = await readJson(req);
      const html = await fetchRemotePage(body);
      return textResponse(html, 200, "text/html; charset=utf-8");
    }

    if (req.method === "GET" && path === "/team-schedule") {
      const schedule = await fetchMaxPrepsSchedule(url.searchParams.get("url") || "");
      return jsonResponse(schedule);
    }

    if (req.method === "GET" && path === "/rpi-snapshots/status") {
      return jsonResponse({ ok: true, backend: "supabase", captureProtected: Boolean(RPI_CRON_SECRET) });
    }

    if (req.method === "POST" && path === "/rpi-snapshots/compare") {
      const body = await readJson(req);
      return jsonResponse(await compareSnapshots(body, false));
    }

    if (req.method === "GET" && path === "/rpi-snapshots/list") {
      const sport = url.searchParams.get("sport") || "";
      const classification = url.searchParams.get("classification") || "";
      const date = url.searchParams.get("date") || "";
      const tzOffset = url.searchParams.get("tzOffset") || "";
      const snapshots = (await selectSnapshots({ sport, classification }, 300))
        .filter((snapshot) => !date || snapshotLocalDate(snapshot.fetchedAt, tzOffset) === date)
        .map(snapshotSummary);
      return jsonResponse({ snapshots });
    }

    if (req.method === "GET" && path === "/rpi-snapshots/snapshot") {
      const id = url.searchParams.get("id") || "";
      const snapshots = await selectSnapshots({ id }, 1);
      if (!snapshots.length) return jsonResponse({ error: "Snapshot not found" }, 404);
      return jsonResponse({ snapshot: snapshots[0] });
    }

    if (req.method === "GET" && path === "/rpi-snapshots/team-log") {
      const sport = url.searchParams.get("sport") || "";
      const classification = url.searchParams.get("classification") || "";
      const seasonYear = url.searchParams.get("seasonYear") || "live";
      const source = url.searchParams.get("source") || "official";
      const school = url.searchParams.get("school") || "";
      const limit = Math.max(1, Number(url.searchParams.get("limit") || 80));
      const snapshots = await selectSnapshots({ sport, classification, season_year: seasonYear, source }, Math.min(limit, 200));
      const logResult = buildTeamSnapshotLog(snapshots, school, school);
      return jsonResponse({
        sport,
        classification,
        seasonYear,
        source,
        school: logResult.school,
        logs: logResult.logs,
      });
    }

    if (path === "/rpi-snapshots/capture" && req.method === "POST") {
      if (!isAuthorizedMutation(req, url)) return jsonResponse({ error: "Unauthorized" }, 401);
      const body = await readJson(req);
      const sport = findSnapshotSport(body.sport);
      const classification = String(body.classification || "").trim();
      if (!sport || !RPI_CLASSES.includes(classification)) throw new Error("Missing or invalid sport/classification");
      return jsonResponse(await captureSnapshot(sport, classification));
    }

    if (path === "/rpi-snapshots/capture-all" && (req.method === "POST" || req.method === "GET")) {
      if (!isAuthorizedMutation(req, url)) return jsonResponse({ error: "Unauthorized" }, 401);
      const stats = { checked: 0, saved: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: "", errors: [] as string[] };
      for (const sport of RPI_SPORTS) {
        for (const classification of RPI_CLASSES) {
          try {
            const result = await captureSnapshot(sport, classification);
            stats.checked += 1;
            if (result.saved) stats.saved += 1;
          } catch (err) {
            stats.failed += 1;
            stats.errors.push(`${sport.label} ${classification}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
      stats.finishedAt = new Date().toISOString();
      return jsonResponse(stats);
    }

    return jsonResponse({ error: "Not found", path }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return jsonResponse({ error: message }, 500);
  }
});
