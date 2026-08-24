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

/**
 * Query search analytics for the trailing `days` window.
 * Returns [{ query, clicks, impressions, ctr, position }, ...] sorted by impressions desc.
 */
export async function fetchQueries({ siteUrl, days = 90, rowLimit = 500 } = {}) {
  const raw = process.env.GSC_SA_KEY;
  if (!raw) return null;
  const site = siteUrl || process.env.GSC_SITE_URL;
  if (!site) throw new Error("GSC site url not set (pass siteUrl or set GSC_SITE_URL)");

  const token = await accessToken(parseKey(raw));
  // GSC data lags ~2 days; end the window there so the last buckets aren't half-empty.
  const end = new Date(Date.now() - 2 * 86400e3);
  const start = new Date(end.getTime() - days * 86400e3);

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        startDate: ymd(start),
        endDate: ymd(end),
        dimensions: ["query"],
        type: "web",
        rowLimit,
      }),
    });

  const data = await res.json();
  if (!res.ok) throw new Error("searchAnalytics failed: " + JSON.stringify(data).slice(0, 300));
  return (data.rows || [])
    .map(r => ({
      query: r.keys[0],
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/**
 * Queries Google already shows us for but where we don't yet rank well —
 * demand that exists and is winnable, as opposed to whatever we happened to write about.
 */
export function opportunities(rows, { minImpressions = 3, minPosition = 6, limit = 40 } = {}) {
  if (!rows) return [];
  return rows
    .filter(r => r.impressions >= minImpressions && r.position >= minPosition)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}
