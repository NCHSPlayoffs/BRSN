// deno-lint-ignore-file no-explicit-any
import * as cheerio from "npm:cheerio@1.2.0";
import TEAM_NAME_NORMALIZE_CONFIG from "../_shared/team-name-normalize.config.json" with { type: "json" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rpi-cron-secret, x-rpi-admin-secret",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RPI_CRON_SECRET = Deno.env.get("RPI_CRON_SECRET") || "";
const RPI_ADMIN_SECRET = Deno.env.get("RPI_ADMIN_SECRET") || "";
const ADMIN_CONFIG_KEY = "app";

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
const fullBracketCache = new Map<string, { cachedAt: number; data: any }>();
const MAXPREPS_SCHEDULE_CACHE_MS = Number(Deno.env.get("MAXPREPS_SCHEDULE_CACHE_MS") || 15 * 60 * 1000);
const MAXPREPS_OPPONENT_RECORD_CACHE_MS = Number(Deno.env.get("MAXPREPS_OPPONENT_RECORD_CACHE_MS") || 30 * 60 * 1000);
const MAXPREPS_OPPONENT_RECORD_CONCURRENCY = Number(Deno.env.get("MAXPREPS_OPPONENT_RECORD_CONCURRENCY") || 4);
const BRACKET_NCHSAA_BASE = "https://www.nchsaa.org";
const BRACKET_MAXPREPS_BASE = "https://www.maxpreps.com";
const BRACKET_DEFAULT_WIDTH = "3000";
const BRACKET_COMPACT_WIDTH = "2300";
const BRACKET_DEFAULT_HEIGHT = "1100";

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

function compileTeamNameNormalizeConfig(raw: any = {}) {
  return {
    phraseReplacements: (Array.isArray(raw.phraseReplacements) ? raw.phraseReplacements : [])
      .map((rule: any) => ({
        from: new RegExp(String(rule.pattern || ""), String(rule.flags || "g")),
        to: String(rule.to || ""),
      }))
      .filter((rule: any) => rule.from.source),
    removePhrases: Array.isArray(raw.removePhrases) ? raw.removePhrases : [],
    removeTokens: Array.isArray(raw.removeTokens) ? raw.removeTokens : [],
    removeTrailingSchool: raw.removeTrailingSchool !== false,
    removeLeadingThe: raw.removeLeadingThe !== false,
    acronymOverrides: raw.acronymOverrides || {},
  };
}

function uniqueStrings(values: any[]) {
  const seen = new Set<string>();
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function mergeNormalizeConfig(base: any = {}, override: any = {}) {
  return {
    phraseReplacements: [
      ...(Array.isArray(base.phraseReplacements) ? base.phraseReplacements : []),
      ...(Array.isArray(override.phraseReplacements) ? override.phraseReplacements : []),
    ],
    removePhrases: uniqueStrings([
      ...(Array.isArray(base.removePhrases) ? base.removePhrases : []),
      ...(Array.isArray(override.removePhrases) ? override.removePhrases : []),
    ]),
    removeTokens: uniqueStrings([
      ...(Array.isArray(base.removeTokens) ? base.removeTokens : []),
      ...(Array.isArray(override.removeTokens) ? override.removeTokens : []),
    ]),
    removeTrailingSchool: override.removeTrailingSchool ?? base.removeTrailingSchool,
    removeLeadingThe: override.removeLeadingThe ?? base.removeLeadingThe,
    acronymOverrides: {
      ...(base.acronymOverrides || {}),
      ...(override.acronymOverrides || {}),
    },
  };
}

function sportKeyFromLabel(value: string | null) {
  const needle = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (needle.includes("football")) return "football";
  if (needle.includes("baseball")) return "baseball";
  if (needle.includes("softball")) return "softball";
  if (needle.includes("volleyball")) return "volleyball";
  if (needle.includes("soccer") && (needle.includes("boy") || needle.includes("men"))) return "boys_soccer";
  if (needle.includes("soccer") && (needle.includes("girl") || needle.includes("women"))) return "girls_soccer";
  if (needle.includes("basket") && (needle.includes("boy") || needle.includes("men"))) return "boys";
  if (needle.includes("basket") && (needle.includes("girl") || needle.includes("women"))) return "girls";
  return needle.replace(/\s+/g, "_");
}

const TEAM_NAME_NORMALIZE = compileTeamNameNormalizeConfig(TEAM_NAME_NORMALIZE_CONFIG);

async function getAdminConfig() {
  try {
    const query = new URLSearchParams({ select: "value", key: `eq.${ADMIN_CONFIG_KEY}`, limit: "1" });
    const records = await restRequest(`/app_admin_config?${query}`);
    return Array.isArray(records) && records[0]?.value && typeof records[0].value === "object"
      ? records[0].value
      : {};
  } catch (err) {
    console.warn("Admin config unavailable; using defaults.", err instanceof Error ? err.message : String(err));
    return {};
  }
}

function normalizeClassKey(value: string) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "all") return "all";
  const match = raw.match(/\b(\d+)A\b/i);
  return match ? `Class ${match[1]}A` : raw;
}

function effectiveNormalizeConfig(adminConfig: any = {}, sportLabel = "", classification = "") {
  const sportKey = sportKeyFromLabel(sportLabel);
  const globalNormalize = adminConfig?.TeamNameNormalize || {};
  const sportNormalize = adminConfig?.TeamNameNormalizeBySport?.[sportKey] || {};
  const classKey = normalizeClassKey(classification);
  const classNormalize = classKey === "all" ? {} : (adminConfig?.TeamNameNormalizeBySportClass?.[sportKey]?.[classKey] || {});
  return compileTeamNameNormalizeConfig(
    mergeNormalizeConfig(
      mergeNormalizeConfig(
        mergeNormalizeConfig(TEAM_NAME_NORMALIZE_CONFIG, globalNormalize),
        sportNormalize
      ),
      classNormalize
    )
  );
}

async function saveAdminConfig(value: any) {
  const records = await restRequest("/app_admin_config?on_conflict=key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify([{
      key: ADMIN_CONFIG_KEY,
      value: value && typeof value === "object" ? value : {},
      updated_at: new Date().toISOString(),
    }]),
  });
  return Array.isArray(records) && records[0]?.value ? records[0].value : {};
}

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

function normalizeSnapshotRows(rows: any[], normalizeConfig = TEAM_NAME_NORMALIZE) {
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => {
      const school = String(row.school || row.team || "").trim();
      const rank = Number(row.rank || index + 1);
      const rpi = Number.parseFloat(String(row.rpi || "").replace(/[^\d.-]/g, ""));
      return {
        teamKey: normalizeTeamKey(school || row.teamKey || "", normalizeConfig),
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

function snapshotFromRecord(record: any, normalizeConfig = TEAM_NAME_NORMALIZE) {
  return {
    id: record.id,
    sport: record.sport,
    classification: record.classification,
    seasonYear: record.season_year,
    source: record.source,
    fetchedAt: record.fetched_at,
    rowHash: record.row_hash,
    rows: normalizeSnapshotRows(record.rows || [], normalizeConfig),
    lastUpdated: record.last_updated || "",
    testMode: Boolean(record.test_mode),
  };
}

async function selectSnapshots(filters: Record<string, string>, limit = 200, normalizeConfig = TEAM_NAME_NORMALIZE) {
  const query = new URLSearchParams({ select: "*", order: "fetched_at.desc", limit: String(limit) });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, `eq.${value}`);
  });
  const records = await restRequest(`/rpi_snapshots?${query}`);
  return (Array.isArray(records) ? records : []).map((record) => snapshotFromRecord(record, normalizeConfig));
}

async function insertSnapshot(snapshot: any, normalizeConfig = TEAM_NAME_NORMALIZE) {
  const records = await restRequest("/rpi_snapshots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(snapshot),
  });
  return snapshotFromRecord(Array.isArray(records) ? records[0] : records, normalizeConfig);
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

function splitTeamAliases(value: string) {
  return String(value || "")
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTeamSnapshotLog(snapshots: any[], school: string, fallbackSchool = "", normalizeConfig = TEAM_NAME_NORMALIZE, aliases: string[] = []) {
  const candidates = uniqueStrings([school, fallbackSchool, ...aliases]);
  const teamKeys = new Set(candidates.map((item) => normalizeTeamKey(item, normalizeConfig)).filter(Boolean));
  const teamKey = [...teamKeys][0] || "";
  const matchingLogs = snapshots
    .map((snapshot) => {
      const row = (snapshot.rows || []).find((item: any) =>
        teamKeys.has(item.teamKey) ||
        teamKeys.has(normalizeTeamKey(item.school, normalizeConfig))
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

async function compareSnapshots(payload: any, allowSave = false, normalizeConfig = TEAM_NAME_NORMALIZE) {
  const sport = String(payload.sport || "").trim();
  const classification = String(payload.classification || "").trim();
  const source = String(payload.source || "official").trim();
  const seasonYear = String(payload.seasonYear || "live").trim();
  const rows = normalizeSnapshotRows(payload.rows, normalizeConfig);
  const shouldSave = allowSave && payload.save !== false;
  const compareSnapshotId = String(payload.compareSnapshotId || "").trim();
  const includeLastChange = payload.includeLastChange === true || payload.includeLastChange === "true";
  if (!sport || !classification || !rows.length) throw new Error("Missing sport, classification, or rows");

  const now = new Date().toISOString();
  const rowHash = await snapshotHash(rows);
  const matching = await selectSnapshots({ sport, classification, season_year: seasonYear, source }, 200, normalizeConfig);

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
    }, normalizeConfig);
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

function isAuthorizedAdmin(req: Request, url: URL) {
  if (!RPI_ADMIN_SECRET) return false;
  const auth = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return auth === RPI_ADMIN_SECRET ||
    req.headers.get("x-rpi-admin-secret") === RPI_ADMIN_SECRET ||
    url.searchParams.get("adminSecret") === RPI_ADMIN_SECRET;
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

async function captureSnapshot(sport: any, classification: string, normalizeConfig = TEAM_NAME_NORMALIZE) {
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
  }, true, normalizeConfig);

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

function bracketCleanSegment(value: any) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function bracketClassSegment(value: any) {
  const match = String(value || "").trim().match(/(\d+)a/i);
  return match ? `${match[1]}a` : bracketCleanSegment(value || "3a");
}

function bracketSportSegment(value: any) {
  const key = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const map: Record<string, string> = {
    football: "football",
    baseball: "baseball",
    softball: "softball",
    volleyball: "volleyball",
    "girls soccer": "womens-soccer",
    "boys soccer": "mens-soccer",
    "girls basketball": "womens-basketball",
    "boys basketball": "mens-basketball",
    wrestling: "wrestling",
  };
  return map[key] || bracketCleanSegment(value || "baseball");
}

function bracketYearSegment(value: any, sportLabel: any) {
  const raw = String(value || "").trim();
  const sportKey = String(sportLabel || "").trim().toLowerCase();
  const fallSports = new Set(["football", "volleyball", "boys soccer", "boys-soccer", "mens-soccer"]);
  if (!raw || raw.toLowerCase() === "live") {
    const now = new Date();
    const current = now.getFullYear();
    return String(fallSports.has(sportKey) && now.getMonth() < 7 ? current - 1 : current);
  }
  const season = raw.match(/^(\d{4})-(\d{2})$/);
  if (season) {
    const start = Number(season[1]);
    const endShort = Number(season[2]);
    const end = Math.floor(start / 100) * 100 + endShort;
    return String(fallSports.has(sportKey) ? start : end);
  }
  const year = raw.match(/\d{4}/);
  return year ? year[0] : String(new Date().getFullYear());
}

function bracketWidgetWidth(classification: string) {
  return classification === "1a" || classification === "8a" ? BRACKET_COMPACT_WIDTH : BRACKET_DEFAULT_WIDTH;
}

function bracketDecodeEntities(value: any) {
  return String(value || "").replace(/&amp;/g, "&");
}

function bracketNormalizeDimension(value: any, fallback: string) {
  if (!value || value === "100%") return fallback;
  const match = String(value).match(/\d+/);
  return match ? match[0] : fallback;
}

function bracketShouldAbsolutize(value: string) {
  return !value.startsWith("#") && !value.startsWith("mailto:") && !value.startsWith("javascript:");
}

function bracketAbsolutizeAttributes($: any, root: any, baseUrl: string) {
  const urlAttrs = ["href", "src", "action", "data-hover-card", "data-lazy-image"];
  root.find("*").addBack().each((_: any, element: any) => {
    const node = $(element);
    for (const attr of urlAttrs) {
      const value = node.attr(attr);
      if (value && bracketShouldAbsolutize(value)) {
        node.attr(attr, new URL(value, baseUrl).toString());
      }
    }

    const srcset = node.attr("srcset");
    if (srcset) {
      node.attr(
        "srcset",
        srcset
          .split(",")
          .map((part: string) => {
            const pieces = part.trim().split(/\s+/);
            if (pieces[0] && bracketShouldAbsolutize(pieces[0])) {
              pieces[0] = new URL(pieces[0], baseUrl).toString();
            }
            return pieces.join(" ");
          })
          .join(", "),
      );
    }
  });
}

async function bracketFetchText(url: string) {
  return await fetchRemotePage({
    url,
    options: {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BRSN bracket customizer/0.1)",
        "Accept": "text/html,application/xhtml+xml",
      },
    },
  });
}

async function discoverFullBracketWidgetUrl(nchsaaUrl: string, widgetWidth = BRACKET_DEFAULT_WIDTH) {
  const html = await bracketFetchText(nchsaaUrl);
  const $ = cheerio.load(html);
  const link = $("a.maxpreps-widget-link").first();
  if (!link.length) throw new Error(`No MaxPreps widget link found on ${nchsaaUrl}`);

  const href = bracketDecodeEntities(link.attr("href") || "");
  const sourceUrl = new URL(href, BRACKET_MAXPREPS_BASE);
  const widgetUrl = new URL("/widgets/tournament.aspx", BRACKET_MAXPREPS_BASE);
  for (const [key, value] of sourceUrl.searchParams) widgetUrl.searchParams.set(key, value);
  widgetUrl.searchParams.set("width", widgetWidth);
  widgetUrl.searchParams.set("height", bracketNormalizeDimension(link.attr("data-height"), BRACKET_DEFAULT_HEIGHT));
  widgetUrl.searchParams.set("allow-scrollbar", link.attr("data-allow-scrollbar") || "true");
  return widgetUrl.toString();
}

async function loadFullBracket({ year, classification, sport }: { year: string; classification: string; sport: string }) {
  const safeYear = bracketCleanSegment(year || new Date().getFullYear());
  const safeClass = bracketClassSegment(classification || "3a");
  const safeSport = bracketSportSegment(sport || "baseball");
  const nchsaaUrl = `${BRACKET_NCHSAA_BASE}/bracket/${safeYear}-${safeClass}-${safeSport}-bracket/`;
  const cached = fullBracketCache.get(nchsaaUrl);
  if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) return cached.data;

  const widgetWidth = bracketWidgetWidth(safeClass);
  const widgetUrl = await discoverFullBracketWidgetUrl(nchsaaUrl, widgetWidth);
  const data = await extractFullBracketWidget(widgetUrl, nchsaaUrl, widgetWidth);
  fullBracketCache.set(nchsaaUrl, { cachedAt: Date.now(), data });
  return data;
}

async function extractFullBracketWidget(widgetUrl: string, sourcePageUrl: string, canvasWidth = BRACKET_DEFAULT_WIDTH) {
  const html = await bracketFetchText(widgetUrl);
  const $ = cheerio.load(html, { decodeEntities: false });
  const form = $("#widget_form").first();
  if (!form.length) throw new Error("MaxPreps response did not include #widget_form.");

  bracketAbsolutizeAttributes($, form, widgetUrl);
  form.find('script[src*="plugins.compressed"]').remove();
  form.find("script").each((_: any, script: any) => {
    const text = $(script).html() || "";
    if (text.includes("mpPrivacy") || text.includes("branch.init")) $(script).remove();
  });
  normalizeFullBracketByeMatchups($, form);
  enhanceFullBracketMascotImages($, form);
  swapFullBracketSides($, form);
  annotateFullBracketForStyling($, form);
  form.find(".matchup-footer").remove();
  ensureFullBracketChampionshipRoundHeaders($, form);
  form.find(".round > .center").remove();
  form.find(".bracket-header").remove();
  form.find(".bracket-logo, .brsn-nchsaa-logo, .brsn-top-branding, .brsn-top-logo").remove();

  const styles: string[] = [];
  $("head link[rel=\"stylesheet\"], head style").each((_: any, element: any) => {
    const node = $(element).clone();
    bracketAbsolutizeAttributes($, node, widgetUrl);
    styles.push($.html(node));
  });

  return {
    title: ($("title").first().text() || "NCHSAA Bracket").trim(),
    sourcePageUrl,
    widgetUrl,
    canvasWidth,
    styles: styles.join("\n"),
    html: $.html(form),
  };
}

function ensureFullBracketChampionshipRoundHeaders($: any, form: any) {
  form.find('[data-view-type="horizontal-championship-view"]').each((_: any, view: any) => {
    $(view).find(".round").each((index: number, round: any) => {
      const label = index === 0 ? "Regional" : "State";
      let header = $(round).find("> .round-header").first();
      if (!header.length) {
        $(round).prepend('<div class="round-header"></div>');
        header = $(round).find("> .round-header").first();
      }
      header.html(`<div class="content"><div class="center"><span class="round-label">${bracketEscapeHtml(label)}</span></div></div>`);
    });
  });
}

function swapFullBracketSides($: any, form: any) {
  form.find('.view[data-view-type="horizontal-view"]').each((_: any, view: any) => {
    const containers = $(view).find("> .rounds");
    if (containers.length !== 2) return;
    const c0 = $(containers[0]);
    const c1 = $(containers[1]);
    const rounds0 = c0.find("> .round").get();
    const rounds1 = c1.find("> .round").get();
    c0.empty();
    c1.empty();
    rounds1.forEach((round: any) => c0.append(round));
    rounds0.forEach((round: any) => c1.append(round));
  });
}

function annotateFullBracketForStyling($: any, form: any) {
  form.find(".bracket-container").addClass("brsn-bracket");
  const matchupLabels = new Map<string, string>();

  form.find('.view[data-view-type="horizontal-view"]').each((_: any, view: any) => {
    const rounds = $(view).find("> .rounds > .round");
    const middle = Math.ceil(rounds.length / 2);
    const gameCounts: Record<string, number> = { west: 0, east: 0 };
    $(view).addClass(`brsn-round-count-${middle}`);

    rounds.each((index: number, round: any) => {
      const sideClass = index < middle ? "brsn-west" : "brsn-east";
      const roundDepth = index < middle ? index : index - middle;
      $(round).addClass(sideClass);
      annotateFullBracketRoundHeader($, $(round), roundDepth);
      $(round).find(".matchup-container").addClass(sideClass).each((__: any, matchup: any) => {
        const side = sideClass === "brsn-west" ? "west" : "east";
        gameCounts[side] += 1;
        annotateFullBracketMatchupHeader($, $(matchup), side, gameCounts[side], matchupLabels);
      });
    });

    const quadrants = $(view).find(".quadrant");
    const labels = quadrants.map((_: any, quadrant: any) => $(quadrant).text().trim()).get();
    const repeated = labels.length === 4 && new Set(labels).size === 1;
    quadrants.each((index: number, quadrant: any) => {
      const isWest = index < 2;
      $(quadrant).addClass(isWest ? "brsn-west" : "brsn-east");
      if (repeated) $(quadrant).text(isWest ? "West" : "East");
    });
  });

  form.find('[data-view-type="horizontal-championship-view"]').each((_: any, view: any) => {
    $(view).addClass("brsn-finals");
    $(view).find(".round").first().find(".matchup-container").each((index: number, matchup: any) => {
      const side = index === 0 ? "east" : "west";
      $(matchup).addClass(side === "west" ? "brsn-west" : "brsn-east");
      annotateFullBracketPlaceholderNames($, $(matchup), matchupLabels);
      annotateFullBracketMatchupHeader($, $(matchup), side, 1, matchupLabels, { forceLeftToRight: true });
    });
    $(view).find(".round").last().find(".matchup-container").each((_: any, matchup: any) => {
      $(matchup).addClass("brsn-championship");
      annotateFullBracketPlaceholderNames($, $(matchup), matchupLabels);
      annotateFullBracketMatchupHeader($, $(matchup), "championship", 1, matchupLabels, { forceLeftToRight: true });
    });
  });

  annotateFullBracketPlaceholderNames($, form, matchupLabels);
}

function annotateFullBracketRoundHeader($: any, round: any, roundDepth: number) {
  const labels = ["First Round", "Second Round", "Third Round", "Quarterfinals", "Semifinals", "Final"];
  const label = labels[roundDepth] || `Round ${roundDepth + 1}`;
  const date = extractFullBracketRoundDate($, round);
  let header = round.find("> .round-header .center").first();
  if (!header.length) {
    const roundHeader = round.find("> .round-header").first();
    if (roundHeader.length) {
      roundHeader.empty();
      roundHeader.append('<div class="center"></div>');
      header = roundHeader.find(".center").first();
    }
  }
  if (header.length) {
    const dateMarkup = date ? `<span class="round-date">${bracketEscapeHtml(date)}</span>` : "";
    header.html(`<span class="round-label">${bracketEscapeHtml(label)}</span>${dateMarkup}`);
  }
}

function extractFullBracketRoundDate($: any, round: any) {
  let dateText = "";
  round.find("a[href*='/games/']").each((_: any, anchor: any) => {
    const href = $(anchor).attr("href") || "";
    const match = href.match(/\/games\/(\d{1,2})-(\d{1,2})-\d{4}\//);
    if (match) {
      dateText = formatFullBracketRoundDate(Number(match[1]), Number(match[2]));
      return false;
    }
    return undefined;
  });
  return dateText;
}

function formatFullBracketRoundDate(month: number, day: number) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[month - 1] || ""} ${day}${getFullBracketOrdinalSuffix(day)}`.trim();
}

function getFullBracketOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  const lastDigit = day % 10;
  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";
  return "th";
}

function normalizeFullBracketByeMatchups($: any, form: any) {
  form.find(".matchup-container.is-bye").each((_: any, matchup: any) => {
    const teams = $(matchup).find(".team");
    const byeResult = teams.find(".result").filter((__: any, result: any) => $(result).text().trim().toLowerCase() === "bye").first();
    const teamWithBye = byeResult.closest(".team");
    const emptyOpponent = teams.filter((__: any, team: any) => {
      const name = $(team).find(".name").text().trim();
      const seed = $(team).find(".seed").text().trim();
      return !name && !seed;
    }).first();
    if (!teamWithBye.length || !emptyOpponent.length) return;
    byeResult.remove();
    emptyOpponent.addClass("brsn-bye-team");
    emptyOpponent.find(".name").remove();
    emptyOpponent.find(".seed").remove();
    emptyOpponent.find(".mascotimage").remove();
    emptyOpponent.append('<span class="seed"></span><span class="mascotimage brsn-empty-logo"></span><span class="name">BYE</span>');
  });
}

function enhanceFullBracketMascotImages($: any, form: any) {
  form.find(".mascotimage img").each((_: any, image: any) => {
    const node = $(image);
    const src = node.attr("src");
    if (!src) return;
    try {
      const url = new URL(src);
      url.searchParams.set("width", "96");
      url.searchParams.set("fit", "bounds");
      node.attr("src", url.toString());
      node.attr("width", "40");
      node.attr("height", "40");
    } catch (_) {
      // Leave uncommon image URLs untouched.
    }
  });
}

function annotateFullBracketMatchupHeader($: any, matchup: any, side: string, gameNumber: number, matchupLabels: Map<string, string>, options: any = {}) {
  const matchupBox = matchup.find("> .matchup").first();
  if (!matchupBox.length) return;
  const existingHeader = matchupBox.find("> .contest-header").first();
  const label = `${formatFullBracketSide(side)} - Game ${gameNumber}`;
  const status = getFullBracketMatchupStatus($, matchup);
  const mirrorHeader = side === "east" && !options.forceLeftToRight;
  const headerContent = mirrorHeader
    ? `<span class="game-status">${bracketEscapeHtml(status)}</span><span class="game-number">${bracketEscapeHtml(label)}</span>`
    : `<span class="game-number">${bracketEscapeHtml(label)}</span><span class="game-status">${bracketEscapeHtml(status)}</span>`;
  const headerHtml = `<header class="contest-header brsn-game-header">${headerContent}</header>`;
  rememberFullBracketMatchupLabel($, matchup, label, matchupLabels);
  matchup.find("> .matchup-header").remove();
  if (existingHeader.length) existingHeader.replaceWith(headerHtml);
  else matchupBox.prepend(headerHtml);
}

function rememberFullBracketMatchupLabel($: any, matchup: any, label: string, matchupLabels: Map<string, string>) {
  if (!matchupLabels) return;
  const matchupId = normalizeFullBracketMatchupId(matchup.attr("id"));
  if (matchupId) matchupLabels.set(matchupId, label);
  const originalGame = matchup.find("> .matchup > .contest-header .game-number").first().text().trim();
  const gameMatch = originalGame.match(/^G\s*(\d+)$/i);
  if (gameMatch) matchupLabels.set(`G${gameMatch[1]}`, label);
}

function annotateFullBracketPlaceholderNames($: any, matchup: any, matchupLabels: Map<string, string>) {
  matchup.find(".team .name").each((_: any, name: any) => {
    const node = $(name);
    const text = node.text().trim();
    const winnerMatch = text.match(/^Winner\s+G\s*(\d+)$/i);
    if (!winnerMatch) return;
    const sourceId = normalizeFullBracketMatchupId(node.closest(".team").attr("data-source-matchup-id"));
    const mappedLabel = (sourceId && matchupLabels.get(sourceId)) || matchupLabels.get(`G${winnerMatch[1]}`);
    if (mappedLabel) node.text(`${mappedLabel} Winner`);
  });
}

function normalizeFullBracketMatchupId(value: any) {
  return String(value || "").trim().replace(/^matchup_/i, "");
}

function getFullBracketMatchupStatus($: any, matchup: any) {
  if (matchup.hasClass("is-bye")) return "Bye";
  const resultText = matchup.find(".result").text().trim().toLowerCase();
  if (resultText.includes("bye")) return "Bye";
  if (matchup.hasClass("has-result") || resultText.length > 0) return "Final";
  return getFullBracketScheduledStatus($, matchup) || "TBD";
}

function getFullBracketScheduledStatus($: any, matchup: any) {
  const abbrText = matchup.find("> .matchup > .contest-header abbr").first().text().trim();
  if (abbrText) return normalizeFullBracketScheduledText(abbrText);
  const datedHref = matchup
    .find("a[href*='/games/']")
    .map((_: any, link: any) => $(link).attr("href") || "")
    .get()
    .find((href: string) => /\/games\/\d{1,2}-\d{1,2}-\d{4}\//.test(href));
  if (!datedHref) return "";
  const match = datedHref.match(/\/games\/(\d{1,2})-(\d{1,2})-\d{4}\//);
  return match ? `${Number(match[1])}/${Number(match[2])}` : "";
}

function normalizeFullBracketScheduledText(value: any) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b(\d{1,2})p\b/gi, "$1PM")
    .replace(/\b(\d{1,2})a\b/gi, "$1AM");
}

function formatFullBracketSide(side: string) {
  if (side === "west") return "West";
  if (side === "east") return "East";
  return "State";
}

function bracketEscapeHtml(value: any) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

    if (req.method === "GET" && path === "/full-bracket") {
      const sportLabel = url.searchParams.get("sport") || "Baseball";
      const classification = url.searchParams.get("classification") || url.searchParams.get("class") || "Class 3A";
      const seasonYear = url.searchParams.get("seasonYear") || url.searchParams.get("year") || "live";
      const bracketYear = bracketYearSegment(seasonYear, sportLabel);
      const payload = await loadFullBracket({
        year: bracketYear,
        classification,
        sport: sportLabel,
      });
      return jsonResponse({
        ...payload,
        bracketYear,
        sport: sportLabel,
        classification,
      });
    }

    if (req.method === "GET" && path === "/rpi-snapshots/status") {
      return jsonResponse({
        ok: true,
        backend: "supabase",
        captureProtected: Boolean(RPI_CRON_SECRET),
        adminProtected: Boolean(RPI_ADMIN_SECRET),
      });
    }

    if (req.method === "GET" && path === "/admin/config") {
      return jsonResponse({
        ok: true,
        config: await getAdminConfig(),
        protected: Boolean(RPI_ADMIN_SECRET),
      });
    }

    if (req.method === "POST" && path === "/admin/config") {
      if (!isAuthorizedAdmin(req, url)) return jsonResponse({ error: "Unauthorized" }, 401);
      const body = await readJson(req);
      const config = await saveAdminConfig(body?.config || {});
      return jsonResponse({ ok: true, config });
    }

    if (req.method === "POST" && path === "/rpi-snapshots/compare") {
      const body = await readJson(req);
      const normalizeConfig = String(body?.seasonYear || "live") === "live"
        ? effectiveNormalizeConfig(await getAdminConfig(), String(body?.sport || ""), String(body?.classification || ""))
        : TEAM_NAME_NORMALIZE;
      return jsonResponse(await compareSnapshots(body, false, normalizeConfig));
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
      const adminConfig = await getAdminConfig();
      let snapshots = await selectSnapshots({ id }, 1, effectiveNormalizeConfig(adminConfig));
      if (snapshots[0]?.sport) {
        snapshots = await selectSnapshots({ id }, 1, effectiveNormalizeConfig(adminConfig, snapshots[0].sport, snapshots[0].classification));
      }
      if (!snapshots.length) return jsonResponse({ error: "Snapshot not found" }, 404);
      return jsonResponse({ snapshot: snapshots[0] });
    }

    if (req.method === "GET" && path === "/rpi-snapshots/team-log") {
      const sport = url.searchParams.get("sport") || "";
      const classification = url.searchParams.get("classification") || "";
      const seasonYear = url.searchParams.get("seasonYear") || "live";
      const source = url.searchParams.get("source") || "official";
      const school = url.searchParams.get("school") || "";
      const schoolAliases = splitTeamAliases(url.searchParams.get("schoolAliases") || "");
      const limit = Math.max(1, Number(url.searchParams.get("limit") || 80));
      const normalizeConfig = seasonYear === "live" ? effectiveNormalizeConfig(await getAdminConfig(), sport, classification) : TEAM_NAME_NORMALIZE;
      const snapshots = await selectSnapshots({ sport, classification, season_year: seasonYear, source }, Math.min(limit, 200), normalizeConfig);
      const logResult = buildTeamSnapshotLog(snapshots, school, school, normalizeConfig, schoolAliases);
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
      return jsonResponse(await captureSnapshot(sport, classification, effectiveNormalizeConfig(await getAdminConfig(), sport.label, classification)));
    }

    if (path === "/rpi-snapshots/capture-all" && (req.method === "POST" || req.method === "GET")) {
      if (!isAuthorizedMutation(req, url)) return jsonResponse({ error: "Unauthorized" }, 401);
      const stats = { checked: 0, saved: 0, failed: 0, startedAt: new Date().toISOString(), finishedAt: "", errors: [] as string[] };
      for (const sport of RPI_SPORTS) {
        for (const classification of RPI_CLASSES) {
          try {
            const result = await captureSnapshot(sport, classification, effectiveNormalizeConfig(await getAdminConfig(), sport.label, classification));
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
