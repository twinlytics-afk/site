// Generate an SEO post. Topic priority: CLI arg -> content/topics.txt -> Claude proposes
// (informed by existing posts and their view counts from /api/views). Publishes as styled HTML.
import fs from "node:fs";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Set ANTHROPIC_API_KEY"); process.exit(1); }
const QUEUE = "content/topics.txt";
const SITE = "https://twinslytics.com";
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

function existingArticles() {
  return fs.readdirSync(".").filter(f => f.startsWith("blog-") && f.endsWith(".html")).map(f => {
    const s = fs.readFileSync(f, "utf-8"); const m = s.match(/<h1>(.*?)<\/h1>/s);
    return { file: f, title: m ? m[1].replace(/<[^>]+>/g, "").trim() : f };
  });
}
async function popularity() {
  try { const r = await fetch(SITE + "/api/views"); return r.ok ? await r.json() : {}; }
  catch { return {}; }
}

async function pickTopic() {
  if (fs.existsSync(QUEUE)) {
    const lines = fs.readFileSync(QUEUE, "utf-8").split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length) return { topic: lines[0], fromQueue: true };
  }
  // queue empty -> let Claude propose, informed by what's published + what's popular
  const arts = existingArticles();
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
function consume() { if (!fromQueue) return; const rest = fs.readFileSync(QUEUE, "utf-8").split("\n").map(l => l.trim()).filter(Boolean).slice(1); fs.writeFileSync(QUEUE, rest.join("\n") + (rest.length ? "\n" : "")); }
if (fs.existsSync(file)) { console.log("Exists, skipping:", file); consume(); process.exit(0); }

const system = `You write SEO blog posts for Twinslytics, ${NICHE}.
Voice: direct, concrete, no fluff, plain verbs, sentence case. Real specifics over buzzwords.
Output ONLY the inner article body as HTML fragments using ONLY these tags: <p>, <h2>, <ul>, <li>, <strong>, <em>. No <html>, <head>, no <h1>, no code fences, no commentary.
Structure: a strong opening hook, then 3-5 <h2> sections with substance, end on a takeaway. 700-1000 words. Section headings under 44 characters. Never invent client names or fake statistics.`;
const { text: inner, raw } = await claude(system, `Write the article. Topic: ${topic}`);
if (!inner) { console.error("No content:", JSON.stringify(raw).slice(0, 400)); process.exit(1); }

const title = topic.charAt(0).toUpperCase() + topic.slice(1);
const desc = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
const date = new Date().toISOString().slice(0, 10);
const tpl = fs.readFileSync("blog-ga4-roas-lying.html", "utf-8");
let html = tpl
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${title} — Twinslytics</title>`)
  .replace(/(name="description" content=")[^"]*(")/, `$1${desc}$2`)
  .replace(/(canonical" href=")[^"]*(")/, `$1${SITE}/${file}$2`)
  .replace(/(og:url" content=")[^"]*(")/, `$1${SITE}/${file}$2`)
  .replace(/(og:title" content=")[^"]*(")/, `$1${title}$2`);
const head = html.slice(0, html.indexOf("<h1>"));
const tail = html.slice(html.indexOf("</article>"));
html = head + `<h1>${title}</h1>\n  <div class="artmeta">${date} · Twinslytics</div>\n\n  ${inner}\n` + tail;
fs.writeFileSync(file, html);
console.log("Wrote", file);

try {
  let blog = fs.readFileSync("blog.html", "utf-8");
  const card = `  <a class="post" href="/${file}">\n    <div class="tag">Article</div>\n    <h3>${title}</h3>\n    <p>${desc}</p>\n    <div class="meta">${date}</div>\n  </a>`;
  if (blog.includes("<!-- POSTS -->")) { blog = blog.replace("<!-- POSTS -->", "<!-- POSTS -->\n" + card); fs.writeFileSync("blog.html", blog); console.log("Card added"); }
} catch (e) { console.error("blog.html skip:", e.message); }
try {
  let sm = fs.readFileSync("sitemap.xml", "utf-8");
  const entry = `  <url><loc>${SITE}/${file}</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>\n`;
  if (!sm.includes(file)) { sm = sm.replace("</urlset>", entry + "</urlset>"); fs.writeFileSync("sitemap.xml", sm); console.log("Sitemap updated"); }
} catch (e) { console.error("sitemap skip:", e.message); }
consume();
console.log("Done.");
