// Generate an SEO blog post with Claude and publish it as a styled HTML page.
// Topic: from CLI arg, else the next line of content/topics.txt (which is then consumed).
// Usage: ANTHROPIC_API_KEY=sk-... node scripts/generate-post.mjs ["topic"]
import fs from "node:fs";

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Set ANTHROPIC_API_KEY"); process.exit(1); }

const QUEUE = "content/topics.txt";
let topic = process.argv.slice(2).join(" ").trim();
let fromQueue = false;

if (!topic) {
  if (!fs.existsSync(QUEUE)) { console.log("No topic and no queue — nothing to do."); process.exit(0); }
  const lines = fs.readFileSync(QUEUE, "utf-8").split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) { console.log("Topic queue empty — nothing to do."); process.exit(0); }
  topic = lines[0];
  fromQueue = true;
  console.log("Using next topic from queue:", topic);
}

const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const file = `blog-${slug}.html`;
if (fs.existsSync(file)) {
  console.log("Post already exists:", file, "- skipping.");
  if (fromQueue) consumeTopic();
  process.exit(0);
}

const system = `You write SEO blog posts for Twinslytics, a data-engineering agency for ecommerce/DTC revenue teams.
Voice: direct, concrete, no fluff, plain verbs, sentence case. Real specifics over buzzwords.
Output ONLY the inner article body as HTML fragments using ONLY these tags: <p>, <h2>, <ul>, <li>, <strong>, <em>. No <html>, <head>, no <h1>, no code fences, no commentary.
Structure: a strong opening hook, then 3-5 <h2> sections with substance, end on a takeaway. 700-1000 words. Section headings under 44 characters. Never invent client names or fake statistics.`;

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
  body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 3000, system, messages: [{ role: "user", content: `Write the article. Topic: ${topic}` }] }),
});
const data = await res.json();
const inner = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
if (!inner) { console.error("No content returned:", JSON.stringify(data).slice(0, 400)); process.exit(1); }

const title = topic.charAt(0).toUpperCase() + topic.slice(1);
const desc = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
const date = new Date().toISOString().slice(0, 10);

const tpl = fs.readFileSync("blog-ga4-roas-lying.html", "utf-8");
let html = tpl
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${title} — Twinslytics</title>`)
  .replace(/(name="description" content=")[^"]*(")/, `$1${desc}$2`)
  .replace(/(canonical" href=")[^"]*(")/, `$1https://twinslytics.com/${file}$2`)
  .replace(/(og:url" content=")[^"]*(")/, `$1https://twinslytics.com/${file}$2`)
  .replace(/(og:title" content=")[^"]*(")/, `$1${title}$2`);

const head = html.slice(0, html.indexOf('<h1>'));
const tail = html.slice(html.indexOf('</article>'));
html = head + `<h1>${title}</h1>\n  <div class="artmeta">${date} · Twinslytics</div>\n\n  ${inner}\n` + tail;
fs.writeFileSync(file, html);
console.log("Wrote", file);

// insert a card into blog.html at the <!-- POSTS --> marker
try {
  let blog = fs.readFileSync("blog.html", "utf-8");
  const card = `  <a class="post" href="/${file}">
    <div class="tag">Article</div>
    <h3>${title}</h3>
    <p>${desc}</p>
    <div class="meta">${date}</div>
  </a>`;
  if (blog.includes("<!-- POSTS -->")) {
    blog = blog.replace("<!-- POSTS -->", "<!-- POSTS -->\n" + card);
    fs.writeFileSync("blog.html", blog);
    console.log("Added card to blog.html");
  }
} catch (e) { console.error("blog.html update skipped:", e.message); }

// add the new URL to sitemap.xml (before </urlset>)
try {
  let sm = fs.readFileSync("sitemap.xml", "utf-8");
  const entry = `  <url><loc>https://twinslytics.com/${file}</loc><changefreq>yearly</changefreq><priority>0.6</priority></url>\n`;
  if (!sm.includes(file)) { sm = sm.replace("</urlset>", entry + "</urlset>"); fs.writeFileSync("sitemap.xml", sm); console.log("Added to sitemap.xml"); }
} catch (e) { console.error("sitemap update skipped:", e.message); }

if (fromQueue) consumeTopic();

function consumeTopic() {
  const rest = fs.readFileSync(QUEUE, "utf-8").split("\n").map(l => l.trim()).filter(Boolean).slice(1);
  fs.writeFileSync(QUEUE, rest.join("\n") + (rest.length ? "\n" : ""));
  console.log("Consumed topic from queue.", rest.length, "left.");
}
