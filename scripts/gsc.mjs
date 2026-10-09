// Search Console access with no dependencies: signs a service-account JWT with
// node:crypto and exchanges it for an access token.
//
// Setup (one time):
//   1. GCP project -> enable "Google Search Console API" -> create a service account
//      -> create a JSON key.
//   2. Search Console -> property twinslytics.com -> Settings -> Users and permissions
//      -> add the service account's client_email as a Full/Restricted user.
//   3. GitHub repo -> Settings -> Secrets -> Actions -> add GSC_SA_KEY = the whole JSON.
//
// Without GSC_SA_KEY the caller falls back to its previous behaviour.
// For a local run without a key, set GSC_ACCESS_TOKEN instead, e.g.
//   export GSC_ACCESS_TOKEN=$(gcloud auth print-access-token \
//     --impersonate-service-account=gsc-reader@sandboxdir.iam.gserviceaccount.com \
//     --scopes=https://www.googleapis.com/auth/webmasters.readonly)
import crypto from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

const b64url = buf => Buffer.from(buf).toString("base64url");

function signedJwt(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = crypto.createSign("RSA-SHA256").update(body).sign(sa.private_key);
  return `${body}.${sig.toString("base64url")}`;
}

async function accessToken(sa) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt(sa),
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("token exchange failed: " + JSON.stringify(data).slice(0, 300));
  return data.access_token;
}

function parseKey(raw) {
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) throw new Error("GSC_SA_KEY missing client_email/private_key");
  return sa;
}

const ymd = d => d.toISOString().slice(0, 10);

/** Properties the service account can read. */
export async function listSites(token) {
  const res = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error("sites.list failed: " + JSON.stringify(data).slice(0, 300));
  return (data.siteEntry || []).map(s => ({ siteUrl: s.siteUrl, level: s.permissionLevel }));
}

/**
 * Pick the property matching `domain`. A property is either a Domain property
 * ("sc-domain:example.com") or a URL prefix ("https://example.com/"), and using
 * the wrong string is the usual cause of a 403 — so resolve it instead of guessing.
 */
export function resolveSite(sites, domain) {
  const usable = sites.filter(s => s.level !== "siteUnverifiedUser");
  const host = domain.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
  const matches = usable.filter(s => {
    const u = s.siteUrl.toLowerCase();
    return u === `sc-domain:${host}` || u === `https://${host}/` || u === `http://${host}/`
      || u === `https://www.${host}/` || u === `sc-domain:${host.replace(/^www\./, "")}`;
  });
  // A Domain property covers every subdomain and scheme, so prefer it.
  const domainProp = matches.find(s => s.siteUrl.startsWith("sc-domain:"));
  if (domainProp || matches.length) return (domainProp || matches[0]).siteUrl;
  // No name match. If the account can read exactly one property, that is the site —
  // this covers the property being verified under the other brand spelling.
  return usable.length === 1 ? usable[0].siteUrl : null;
}

/** Token from the environment: an explicit one (local runs) or a service-account key (CI). */
async function getToken() {
  if (process.env.GSC_ACCESS_TOKEN) return process.env.GSC_ACCESS_TOKEN;
  const raw = process.env.GSC_SA_KEY;
  return raw ? accessToken(parseKey(raw)) : null;
}

/**
 * Which property to query. An explicit GSC_SITE_URL wins, but only if this account
 * can actually read it — a stale value (the URL-prefix form when only the Domain
 * property is shared) would otherwise fail as a silent 403.
 */
async function resolveProperty(token, hint) {
  const sites = await listSites(token);
  const env = process.env.GSC_SITE_URL;
  if (env && sites.some(s => s.siteUrl === env)) return env;
  if (env) console.log(`GSC_SITE_URL=${env} is not readable by this account, resolving instead`);
  const site = resolveSite(sites, hint || "twinslytics.com");
  if (!site) {
    throw new Error("no readable Search Console property matched. The service account can see: "
      + (sites.map(s => `${s.siteUrl} (${s.level})`).join(", ") || "nothing — has it been added as a user?"));
  }
  console.log("GSC property:", site);
  return site;
}

// GSC data lags ~2 days; end the window there so the last buckets aren't half-empty.
function dateWindow(days) {
  const end = new Date(Date.now() - 2 * 86400e3);
  const start = new Date(end.getTime() - days * 86400e3);
  return { startDate: ymd(start), endDate: ymd(end) };
}

async function searchAnalytics(token, site, body) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ type: "web", ...body }),
    });
  const data = await res.json();
  if (!res.ok) throw new Error("searchAnalytics failed: " + JSON.stringify(data).slice(0, 300));
  return data.rows || [];
}

// /x, /x.html and http://…/x are one page for our purposes — the site serves
// every .html at its extensionless twin, and GSC lists both spellings.
const pagePath = u => { try { return new URL(u).pathname.replace(/\.html$/, "") || "/"; } catch { return u; } };

/**
 * Query search analytics for the trailing `days` window.
 * Returns [{ query, clicks, impressions, ctr, position }, ...] sorted by impressions desc.
 * With `withPages`, each row also carries `pages`: the URLs of OUR site that Google
 * showed for that query, best first — so a caller can tell "no page targets this"
 * from "a page exists but ranks poorly".
 */
export async function fetchQueries({ siteUrl, days = 90, rowLimit = 500, withPages = false } = {}) {
  const token = await getToken();
  if (!token) return null;
  const site = await resolveProperty(token, siteUrl);
  const win = dateWindow(days);

  if (!withPages) {
    const rows = await searchAnalytics(token, site, { ...win, dimensions: ["query"], rowLimit });
    return rows
      .map(r => ({ query: r.keys[0], clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position || 0 }))
      .sort((a, b) => b.impressions - a.impressions);
  }

  const rows = await searchAnalytics(token, site, { ...win, dimensions: ["query", "page"], rowLimit: 5000 });
  const byQuery = new Map();
  for (const r of rows) {
    const [query, page] = r.keys;
    const imp = r.impressions || 0;
    let q = byQuery.get(query);
    if (!q) byQuery.set(query, q = { query, clicks: 0, impressions: 0, posWeighted: 0, pages: new Map() });
    q.clicks += r.clicks || 0;
    q.impressions += imp;
    q.posWeighted += (r.position || 0) * imp;
    const path = pagePath(page);
    const pg = q.pages.get(path) || { page: path, impressions: 0, clicks: 0, posWeighted: 0 };
    pg.impressions += imp; pg.clicks += r.clicks || 0; pg.posWeighted += (r.position || 0) * imp;
    q.pages.set(path, pg);
  }
  return [...byQuery.values()]
    .map(q => ({
      query: q.query, clicks: q.clicks, impressions: q.impressions,
      ctr: q.impressions ? q.clicks / q.impressions : 0,
      position: q.impressions ? q.posWeighted / q.impressions : 0,
      pages: [...q.pages.values()]
        .map(p => ({ page: p.page, impressions: p.impressions, clicks: p.clicks, position: p.impressions ? p.posWeighted / p.impressions : 0 }))
        .sort((a, b) => b.impressions - a.impressions),
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/** Whole-site totals (includes the anonymized queries a per-query listing hides) and top pages. */
export async function fetchSummary({ siteUrl, days = 90 } = {}) {
  const token = await getToken();
  if (!token) return null;
  const site = await resolveProperty(token, siteUrl);
  const win = dateWindow(days);
  const [tot] = await searchAnalytics(token, site, win);
  const pages = await searchAnalytics(token, site, { ...win, dimensions: ["page"], rowLimit: 500 });
  const merged = new Map();
  for (const r of pages) {
    const path = pagePath(r.keys[0]);
    const m = merged.get(path) || { page: path, impressions: 0, clicks: 0, posWeighted: 0 };
    m.impressions += r.impressions || 0; m.clicks += r.clicks || 0; m.posWeighted += (r.position || 0) * (r.impressions || 0);
    merged.set(path, m);
  }
  return {
    window: win,
    totals: tot ? { clicks: tot.clicks, impressions: tot.impressions, ctr: tot.ctr, position: tot.position } : null,
    pages: [...merged.values()].map(m => ({ page: m.page, impressions: m.impressions, clicks: m.clicks, position: m.impressions ? m.posWeighted / m.impressions : 0 }))
      .sort((a, b) => b.impressions - a.impressions),
  };
}

/**
 * Queries that exist in Search Console but are worthless to write against.
 * This site ranks incidentally for other companies whose names also end in
 * "lytics" — untreated, those brand names dominate the impression ranking and
 * the generator writes an article about a competitor's brand.
 */
export function isJunkQuery(q) {
  const s = String(q).trim().toLowerCase();
  if (!s) return true;
  // Someone else's scraper: search operators, not a human's question.
  if (/(^|\s)-?site:/.test(s) || /(^|\s)[-+]"/.test(s)) return true;
  // Hostnames and URLs. Match a domain, not any slash — "$150k/month" is a
  // real question, not a path.
  if (/[a-z0-9-]+\.(com|net|org|io|ai|jp|ua)\b/.test(s) || /https?:\/\//.test(s)) return true;
  // Our own brand, in both spellings: already ranking, nothing to win.
  if (/twins?lytics|twinsly/.test(s)) return true;
  // A single token is either a brand name or too broad to target. Real
  // informational demand in this niche is always more than one word.
  if (!s.includes(" ")) return true;
  return false;
}

/**
 * Queries Google already shows us for but where we rank on page 2 or worse —
 * demand that exists and a NEW article could plausibly win. Anything already on
 * page 1 (position < 11) is deliberately left out: that is a job for improving the
 * page that ranks, and a second article would only compete with it.
 */
export function opportunities(rows, { minImpressions = 3, minPosition = 11, limit = 40 } = {}) {
  if (!rows) return [];
  const ranked = rows.filter(r => r.impressions >= minImpressions && r.position >= minPosition);
  const kept = ranked.filter(r => !isJunkQuery(r.query));
  const dropped = ranked.length - kept.length;
  if (dropped) console.log(`GSC: dropped ${dropped} brand/operator queries, kept ${kept.length}`);
  return kept.sort((a, b) => b.impressions - a.impressions).slice(0, limit);
}

/**
 * Page-1 queries with no clicks yet: the cheapest wins on the site. The right page
 * is already ranking, so the lever is its title, meta description and opening —
 * not a new article.
 */
export function quickWins(rows, { minImpressions = 4, minPosition = 3, maxPosition = 11, limit = 15 } = {}) {
  if (!rows) return [];
  return rows
    .filter(r => r.impressions >= minImpressions && r.position >= minPosition && r.position < maxPosition && !isJunkQuery(r.query))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}
