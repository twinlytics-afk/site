// Generate an SEO post.
// Topic priority: CLI arg -> content/topics.txt -> Search Console opportunities
// -> Claude proposes. Publishes as styled HTML with a diagram and internal links.
import fs from "node:fs";
import { renderDiagram, DIAGRAM_SCHEMA } from "./diagram.mjs";
import { fetchQueries, opportunities } from "./gsc.mjs";
import { CATS, PILLARS, readPosts, sync } from "./sync-blog.mjs";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Set ANTHROPIC_API_KEY"); process.exit(1); }
const QUEUE = "content/topics.txt";
const SITE = "https://twinslytics.com";
const TEMPLATE = "blog-ga4-roas-lying.html";
const NICHE = "data engineering for ecommerce/DTC revenue teams — attribution, true ROAS, data pipelines and warehousing, AI agents/automation, and marketing analytics";

async function claude(system, user, max = 3000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: max, system, messages: [{ role: "user", content: user }] }),
  });
  const data = await res.json();
  return { text: (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim(), raw: data };
}

async function claudeJson(system, user, max = 900) {
  const { text } = await claude(system, user, max);
  const body = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = s => esc(s).replace(/"/g, "&quot;");
const stripTags = s => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

async function popularity() {
  try { const r = await fetch(SITE + "/api/views"); return r.ok ? await r.json() : {}; }
  catch { return {}; }
}

// AI & automation is too thin to be its own link cluster.
const clusterOf = cat => (cat === "AI & automation" ? "Data engineering" : cat);

// Diversity. Left alone, the picker leaned toward the most-viewed posts and
// the blog turned into ten "Build an AI agent that..." posts in a row, which
// competed with each other for the same queries. So: rotate categories, and
// reject a topic or title that opens like, or mostly overlaps, a recent one.
const RECENT_N = 10;
const recent = readPosts().slice(0, RECENT_N);
const STOP = new Set("a an the to for of and or in on with your you how why what when that this by from is are vs".split(" "));
const words = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
const opener = s => words(s).slice(0, 3).join(" ");
const keyset = s => new Set(words(s).filter(w => !STOP.has(w)));
function tooSimilar(text) {
  const o = opener(text), k = keyset(text);
  return recent.find(p => {
    if (opener(p.title) === o) return true;
    const pk = keyset(p.title);
    const inter = [...k].filter(w => pk.has(w)).length;
    return inter / (new Set([...k, ...pk]).size || 1) >= 0.5;
  });
}
// The category least used among the last six posts (ties: least used overall).
function targetCategory() {
  const all = readPosts();
  const last = all.slice(0, 6);
  const n = (list, c) => list.filter(p => p.category === c).length;
  return [...CATS].sort((a, b) => n(last, a) - n(last, b) || n(all, a) - n(all, b))[0];
}
const TARGET = targetCategory();
const recentList = recent.map(p => `- ${p.title} [${p.category}]`).join("\n");
const diversityRules = `Recently published (newest first):\n${recentList}\n
Rules: do NOT reuse the opening words or sentence pattern of any recent title (e.g. if several start "Build an AI agent that...", do not write another). Pick a different angle and format: a how-to, a diagnosis, a comparison, a checklist, a decision guide, a teardown of a common mistake.`;
const cleanLine = text => text.split("\n")[0].replace(/^[-*\d.\s]+/, "").replace(/^["']|["']$/g, "").trim();

// Asks for a topic, and re-asks (up to 3 times) when it collides with a recent post.
async function askTopic(sys, usr) {
  let feedback = "", topic = "";
  for (let i = 0; i < 3; i++) {
    const { text, raw } = await claude(sys, usr + feedback, 500);
    topic = cleanLine(text);
    if (!topic) { console.error("Topic call returned nothing:", JSON.stringify(raw).slice(0, 400)); return ""; }
    const clash = tooSimilar(topic);
    if (!clash) return topic;
    console.log(`Topic too close to "${clash.title}", retrying:`, topic);
    feedback += `\n\nRejected (too close to "${clash.title}"): ${topic}. Propose something clearly different.`;
  }
  return topic;
}

function relatedTo(category, arts, n = 2) {
  const want = clusterOf(category);
  const inCluster = arts.filter(a => clusterOf(a.category) === want);
  const rest = arts.filter(a => clusterOf(a.category) !== want);
  return [...inCluster, ...rest].slice(0, n);
}

async function searchDemand() {
  try {
    const rows = await fetchQueries({ siteUrl: process.env.GSC_SITE_URL || SITE + "/", days: 90 });
    if (!rows) { console.log("GSC: no GSC_SA_KEY, skipping search-demand topics"); return []; }
    const opp = opportunities(rows);
    console.log(`GSC: ${rows.length} queries, ${opp.length} opportunities`);
    return opp;
  } catch (e) {
    console.error("GSC lookup failed, continuing without it:", e.message);
    return [];
  }
}

async function pickTopic() {
  if (fs.existsSync(QUEUE)) {
    const lines = fs.readFileSync(QUEUE, "utf-8").split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length) return { topic: lines[0], fromQueue: true };
  }

  const arts = readPosts();
  const covered = arts.map(a => `- ${a.title}`).join("\n") || "(none yet)";
  const opp = await searchDemand();

  if (opp.length) {
    const demand = opp.map(r =>
      `- "${r.query}" — ${r.impressions} impressions, ${r.clicks} clicks, avg position ${r.position.toFixed(1)}`
    ).join("\n");
    const sys = `You plan SEO blog topics for Twinslytics, ${NICHE}.
These are real Google Search Console queries the site already appears for but does not rank well on — existing demand that is winnable with a dedicated article.
Pick the single highest-value cluster of related queries and return ONE topic line that targets it head-on: lowercase, no quotes, no numbering, under 12 words. It must not duplicate an already-published article.
Prefer queries with high impressions and weak position, but judge relevance before volume. IGNORE any query that is a company or product name rather than a question — this site ranks incidentally for other vendors whose names also end in "lytics", and an article about a competitor's brand is worthless. Also ignore anything that looks like a scraper's query or an internal hostname.
Long conversational queries are valuable: they come from AI search and state the reader's problem in their own words. Prefer them over short generic head terms when the intent is clearer.
When two clusters are close in value, prefer one that fits the "${TARGET}" category — the blog has had little of it lately.
${diversityRules}`;
    const usr = `Search Console queries with weak rankings:\n${demand}\n\nAlready published:\n${covered}\n\nReturn the single best next topic.`;
    // Higher than it looks like it needs: a multi-instruction system prompt makes the
    // model think longer before answering, and a tight cap here previously spent the
    // whole budget on that reasoning and left nothing for the actual topic line.
    const topic = await askTopic(sys, usr);
    if (topic) { console.log("Topic from search demand:", topic); return { topic, fromQueue: false }; }
    console.error("Search-demand topic call returned nothing, falling back");
  }

  // Nothing from GSC (new site, API off, or no weak-position queries yet).
  const views = await popularity();
  const ranked = arts.map(a => ({ ...a, v: views["/" + a.file] || 0 })).sort((x, y) => y.v - x.v);
  const list = ranked.map(a => `- ${a.title} (${a.v} views)`).join("\n") || "(none yet)";
  const sys = `You plan SEO blog topics for Twinslytics, ${NICHE}. Return ONLY one topic line: lowercase, no quotes, no numbering, under 12 words. It must be a genuinely NEW angle not already covered.
The next post MUST belong to the "${TARGET}" category. Use view counts only as a hint about what readers care about, never as a template to copy.
${diversityRules}`;
  const usr = `Published posts with view counts (higher = more popular):\n${list}\n\nPropose the single best next topic to write.`;
  const topic = await askTopic(sys, usr);
  console.log("Claude proposed topic:", topic);
  return { topic, fromQueue: false };
}

const cli = process.argv.slice(2).join(" ").trim();
let topic, fromQueue = false;
if (cli) { topic = cli; }
else { const p = await pickTopic(); topic = p.topic; fromQueue = p.fromQueue; }
if (!topic) { console.log("No topic could be determined — nothing to do."); process.exit(0); }
console.log("Topic:", topic, fromQueue ? "(from queue)" : "(auto)");

// Cut on a word boundary: slice(0, 60) used to leave slugs like "...before-roas-dr".
function slugify(s, max = 60) {
  let out = "";
  for (const w of s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ")) {
    const next = out ? `${out}-${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || s.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, max);
}
const slug = slugify(topic);
const file = `blog-${slug}.html`;
// Cloudflare serves every .html file at its extensionless twin via a redirect
// and there's no config that turns that off without also breaking "/" ->
// index.html. So `file` is the real filename on disk, and `url` is the only
// address the site should ever advertise about itself — canonical, og:url,
// JSON-LD, sitemap, and every internal link.
const url = `${SITE}/blog-${slug}`;
const stripHtml = f => f.replace(/\.html$/, "");
function consume() {
  if (!fromQueue) return;
  const rest = fs.readFileSync(QUEUE, "utf-8").split("\n").map(l => l.trim()).filter(Boolean).slice(1);
  fs.writeFileSync(QUEUE, rest.join("\n") + (rest.length ? "\n" : ""));
}
if (fs.existsSync(file)) { console.log("Exists, skipping:", file); consume(); process.exit(0); }

const system = `You write SEO blog posts for Twinslytics, ${NICHE}.
Voice: direct, concrete, no fluff, plain verbs, sentence case. Real specifics over buzzwords.
Output ONLY the inner article body as HTML fragments using ONLY these tags: <p>, <h2>, <ul>, <li>, <strong>, <em>. No <html>, <head>, no <h1>, no code fences, no commentary.
Structure: a strong opening hook, then 3-5 <h2> sections with substance, end on a takeaway. 900-1300 words. Section headings under 44 characters. Never invent client names or fake statistics.`;
const { text: inner, raw } = await claude(system, `Write the article. Topic: ${topic}`, 4000);
if (!inner) { console.error("No content:", JSON.stringify(raw).slice(0, 400)); process.exit(1); }

// Search-result copy is written deliberately: it is the whole CTR lever.
const metaSys = `You write search-result copy for Twinslytics, ${NICHE}.
Return ONLY minified JSON: {"title":"...","description":"...","category":"..."}
title: the SEO title/headline. Under 60 characters, sentence case, no site name, no quotes. Capitalise acronyms correctly (ROAS, GA4, CAPI, LTV, CRM, dbt, MMM, CAC, DTC). Concrete and specific — it competes for a click against nine other results.
description: 140-158 characters, one or two sentences, says what the reader gets and why it matters. No ellipsis, no truncation mid-sentence, no "in this article".
category: EXACTLY one of: ${CATS.join(", ")}${fromQueue || cli ? "" : ` (this post was planned as "${TARGET}"; use it unless it clearly does not fit)`}
The title must not open with the same words or pattern as any of these recent titles:
${recentList}`;
const metaUsr = `Topic: ${topic}\n\nArticle:\n${stripTags(inner).slice(0, 2500)}`;
let metaOut = await claudeJson(metaSys, metaUsr);
const titleClash = metaOut?.title && tooSimilar(metaOut.title);
if (titleClash) {
  console.log(`Title too close to "${titleClash.title}", retrying:`, metaOut.title);
  const again = await claudeJson(metaSys, `${metaUsr}\n\nRejected title (too close to "${titleClash.title}"): ${metaOut.title}. Write a clearly different one.`);
  if (again?.title) metaOut = again;
}

const fallbackTitle = topic.charAt(0).toUpperCase() + topic.slice(1);
const title = (metaOut?.title || fallbackTitle).trim().replace(/^["']|["']$/g, "");
const desc = (metaOut?.description || stripTags(inner).slice(0, 155)).trim().replace(/^["']|["']$/g, "");
const category = CATS.includes(metaOut?.category) ? metaOut.category : "Data engineering";

const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const _d = new Date();
const date = `${_d.getDate()} ${M[_d.getMonth()]} ${_d.getFullYear()}`;
const isoDate = _d.toISOString().slice(0, 10);
const mins = Math.max(1, Math.round(stripTags(inner).split(/\s+/).filter(Boolean).length / 200));
console.log("title:", title, "| category:", category, "| read:", mins, "min");

// Diagram: the model supplies only content, scripts/diagram.mjs owns the layout,
// so a malformed spec means no diagram rather than a broken one.
let figure = "";
const spec = await claudeJson(
  `You design one diagram for a blog post by Twinslytics, ${NICHE}.\n${DIAGRAM_SCHEMA}`,
  `Topic: ${topic}\n\nArticle:\n${stripTags(inner).slice(0, 2500)}`);
figure = renderDiagram(spec) || "";
console.log("diagram:", figure ? spec.type : "none");

const arts = readPosts();
const [pillarFile, pillarLabel] = PILLARS[category] || PILLARS["Data engineering"];
const links = [
  `    <li><a href="/${stripHtml(pillarFile)}">${esc(pillarLabel)}</a></li>`,
  ...relatedTo(category, arts, 2).map(a => `    <li><a href="/${stripHtml(a.file)}">${esc(a.title)}</a></li>`),
];
const furtherReading = `\n  <h2>Further reading</h2>\n  <ul>\n${links.join("\n")}\n  </ul>\n`;

const tpl = fs.readFileSync(TEMPLATE, "utf-8");
let html = tpl
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} — Twinslytics</title>`)
  .replace(/(name="description" content=")[^"]*(")/, `$1${escAttr(desc)}$2`)
  .replace(/(canonical" href=")[^"]*(")/, `$1${url}$2`)
  .replace(/(og:url" content=")[^"]*(")/, `$1${url}$2`)
  .replace(/(og:title" content=")[^"]*(")/, `$1${escAttr(title)}$2`)
  .replace(/(og:description" content=")[^"]*(")/, `$1${escAttr(desc)}$2`)
  .replace(/("headline":")[^"]*(")/, `$1${escAttr(title)}$2`)
  .replace(/("datePublished":")[^"]*(")/, `$1${isoDate}$2`)
  .replace(/("mainEntityOfPage":")[^"]*(")/, `$1${url}$2`)
  .replace('<span class="eyebrow">Attribution</span>', `<span class="eyebrow">${esc(category)}</span>`);

// The JSON-LD description is a separate field from the meta tag; replace it after
// the meta tag above so the two stay in sync.
html = html.replace(/("description":")[^"]*(")/, `$1${escAttr(desc)}$2`);

// The template's breadcrumb still names itself; retarget its last item to this post.
html = html.replace(
  /("position":\s*3,\s*"name":\s*")[^"]*("\s*,\s*"item":\s*")[^"]*(")/,
  `$1${escAttr(title)}$2${url}$3`
);

const head = html.slice(0, html.indexOf("<h1>"));
const tail = html.slice(html.indexOf("</article>"));
const body = `<h1>${esc(title)}</h1>\n`
  + `  <div class="artmeta">${date} · ${mins} min read · Twinslytics<span class="artviews"></span></div>\n\n`
  + (figure ? figure + "\n\n" : "")
  + `  ${inner}\n`
  + furtherReading;
fs.writeFileSync(file, head + body + tail);
console.log("Wrote", file);

// Blog grid, filters, guide lists and counts are all rebuilt from the posts.
try { sync(); } catch (e) { console.error("sync skip:", e.message); }

try {
  let sm = fs.readFileSync("sitemap.xml", "utf-8");
  const entry = `  <url><loc>${url}</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>\n`;
  if (!sm.includes(stripHtml(file))) {
    sm = sm.replace("</urlset>", entry + "</urlset>");
    fs.writeFileSync("sitemap.xml", sm);
    console.log("Sitemap updated");
  }
} catch (e) { console.error("sitemap skip:", e.message); }

consume();
console.log("Done.");
