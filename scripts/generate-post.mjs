// Generate an SEO post.
// Topic priority: CLI arg -> content/topics.txt -> Search Console opportunities
// -> Claude proposes. Publishes as styled HTML with a diagram and internal links.
import fs from "node:fs";
import { renderDiagram, DIAGRAM_SCHEMA } from "./diagram.mjs";
import { fetchQueries, opportunities } from "./gsc.mjs";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Set ANTHROPIC_API_KEY"); process.exit(1); }
const QUEUE = "content/topics.txt";
const SITE = "https://twinslytics.com";
const TEMPLATE = "blog-ga4-roas-lying.html";
const NICHE = "data engineering for ecommerce/DTC revenue teams — attribution, true ROAS, data pipelines and warehousing, AI agents/automation, and marketing analytics";
const CATS = ["Attribution", "Marketing analytics", "Data engineering", "AI & automation", "ML", "Analytics"];

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

function existingArticles() {
  return fs.readdirSync(".").filter(f => f.startsWith("blog-") && f.endsWith(".html")).map(f => {
    const s = fs.readFileSync(f, "utf-8");
    const t = s.match(/<h1>(.*?)<\/h1>/s);
    const c = s.match(/eyebrow">([^<]*)<\/span>/);
    return {
      file: f,
      title: t ? stripTags(t[1]) : f,
      category: c ? c[1].trim() : "Data engineering",
    };
  });
}

async function popularity() {
  try { const r = await fetch(SITE + "/api/views"); return r.ok ? await r.json() : {}; }
  catch { return {}; }
}

// AI & automation is too thin to be its own link cluster.
const clusterOf = cat => (cat === "AI & automation" ? "Data engineering" : cat);

// Every post links up to its pillar page, so each cluster has one hub that
// accumulates the internal links instead of 18 posts pointing sideways.
const PILLARS = {
  "Attribution": ["guide-attribution.html", "Guide: Marketing attribution for ecommerce"],
  "Marketing analytics": ["guide-true-roas.html", "Guide: True ROAS, and how to get to it"],
  "Data engineering": ["guide-data-pipelines.html", "Guide: Revenue pipelines that survive production"],
  "AI & automation": ["guide-data-pipelines.html", "Guide: Revenue pipelines that survive production"],
  "ML": ["guide-data-pipelines.html", "Guide: Revenue pipelines that survive production"],
  "Analytics": ["guide-true-roas.html", "Guide: True ROAS, and how to get to it"],
};

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

  const arts = existingArticles();
  const covered = arts.map(a => `- ${a.title}`).join("\n") || "(none yet)";
  const opp = await searchDemand();

  if (opp.length) {
    const demand = opp.map(r =>
      `- "${r.query}" — ${r.impressions} impressions, ${r.clicks} clicks, avg position ${r.position.toFixed(1)}`
    ).join("\n");
    const sys = `You plan SEO blog topics for Twinslytics, ${NICHE}.
These are real Google Search Console queries the site already appears for but does not rank well on — existing demand that is winnable with a dedicated article.
Pick the single highest-value cluster of related queries and return ONE topic line that targets it head-on: lowercase, no quotes, no numbering, under 12 words. It must not duplicate an already-published article. Prefer queries with high impressions and weak position. Ignore branded queries (containing "twinslytics" or "twinlytics").`;
    const usr = `Search Console queries with weak rankings:\n${demand}\n\nAlready published:\n${covered}\n\nReturn the single best next topic.`;
    const { text } = await claude(sys, usr, 120);
    const topic = text.split("\n")[0].replace(/^[-*\d.\s]+/, "").replace(/^["']|["']$/g, "").trim();
    if (topic) { console.log("Topic from search demand:", topic); return { topic, fromQueue: false }; }
  }

  // Nothing from GSC (new site, API off, or no weak-position queries yet).
  const views = await popularity();
  const ranked = arts.map(a => ({ ...a, v: views["/" + a.file] || 0 })).sort((x, y) => y.v - x.v);
  const list = ranked.map(a => `- ${a.title} (${a.v} views)`).join("\n") || "(none yet)";
  const sys = `You plan SEO blog topics for Twinslytics, ${NICHE}. Return ONLY one topic line: lowercase, no quotes, no numbering, under 12 words. It must be a genuinely NEW angle not already covered, and should lean toward the themes of the best-performing existing posts.`;
  const usr = `Published posts with view counts (higher = more popular):\n${list}\n\nPropose the single best next topic to write.`;
  const { text } = await claude(sys, usr, 120);
  const topic = text.split("\n")[0].replace(/^[-*\d.\s]+/, "").replace(/^["']|["']$/g, "").trim();
  console.log("Claude proposed topic:", topic);
  return { topic, fromQueue: false };
}

const cli = process.argv.slice(2).join(" ").trim();
let topic, fromQueue = false;
if (cli) { topic = cli; }
else { const p = await pickTopic(); topic = p.topic; fromQueue = p.fromQueue; }
if (!topic) { console.log("No topic could be determined — nothing to do."); process.exit(0); }
console.log("Topic:", topic, fromQueue ? "(from queue)" : "(auto)");

const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const file = `blog-${slug}.html`;
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
category: EXACTLY one of: ${CATS.join(", ")}`;
const metaOut = await claudeJson(metaSys, `Topic: ${topic}\n\nArticle:\n${stripTags(inner).slice(0, 2500)}`);

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

const arts = existingArticles();
const [pillarFile, pillarLabel] = PILLARS[category] || PILLARS["Data engineering"];
const links = [
  `    <li><a href="/${pillarFile}">${esc(pillarLabel)}</a></li>`,
  ...relatedTo(category, arts, 2).map(a => `    <li><a href="/${a.file}">${esc(a.title)}</a></li>`),
];
const furtherReading = `\n  <h2>Further reading</h2>\n  <ul>\n${links.join("\n")}\n  </ul>\n`;

const tpl = fs.readFileSync(TEMPLATE, "utf-8");
let html = tpl
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)} — Twinslytics</title>`)
  .replace(/(name="description" content=")[^"]*(")/, `$1${escAttr(desc)}$2`)
  .replace(/(canonical" href=")[^"]*(")/, `$1${SITE}/${file}$2`)
  .replace(/(og:url" content=")[^"]*(")/, `$1${SITE}/${file}$2`)
  .replace(/(og:title" content=")[^"]*(")/, `$1${escAttr(title)}$2`)
  .replace(/(og:description" content=")[^"]*(")/, `$1${escAttr(desc)}$2`)
  .replace(/("headline":")[^"]*(")/, `$1${escAttr(title)}$2`)
  .replace(/("datePublished":")[^"]*(")/, `$1${isoDate}$2`)
  .replace(/("mainEntityOfPage":")[^"]*(")/, `$1${SITE}/${file}$2`)
  .replace('<span class="eyebrow">Attribution</span>', `<span class="eyebrow">${esc(category)}</span>`);

// The JSON-LD description is a separate field from the meta tag; replace it after
// the meta tag above so the two stay in sync.
html = html.replace(/("description":")[^"]*(")/, `$1${escAttr(desc)}$2`);

const head = html.slice(0, html.indexOf("<h1>"));
const tail = html.slice(html.indexOf("</article>"));
const body = `<h1>${esc(title)}</h1>\n`
  + `  <div class="artmeta">${date} · ${mins} min read · Twinslytics<span class="artviews"></span></div>\n\n`
  + (figure ? figure + "\n\n" : "")
  + `  ${inner}\n`
  + furtherReading;
fs.writeFileSync(file, head + body + tail);
console.log("Wrote", file);

try {
  let blog = fs.readFileSync("blog.html", "utf-8");
  const card = `  <a class="post" href="/${file}">\n    <div class="tag">${esc(category)}</div>\n    <h3>${esc(title)}</h3>\n    <p>${esc(desc)}</p>\n    <div class="meta">${date} · ${mins} min read<span class="views" data-p="/${file}"></span></div>\n  </a>`;
  if (blog.includes("<!-- POSTS -->")) {
    blog = blog.replace("<!-- POSTS -->", "<!-- POSTS -->\n" + card);
    fs.writeFileSync("blog.html", blog);
    console.log("Card added");
  }
} catch (e) { console.error("blog.html skip:", e.message); }

try {
  let sm = fs.readFileSync("sitemap.xml", "utf-8");
  const entry = `  <url><loc>${SITE}/${file}</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>\n`;
  if (!sm.includes(file)) {
    sm = sm.replace("</urlset>", entry + "</urlset>");
    fs.writeFileSync("sitemap.xml", sm);
    console.log("Sitemap updated");
  }
} catch (e) { console.error("sitemap skip:", e.message); }

consume();
console.log("Done.");
