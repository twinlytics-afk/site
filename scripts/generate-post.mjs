// Generate an SEO blog post with Claude and write it as a styled HTML page.
// Usage: ANTHROPIC_API_KEY=sk-... node scripts/generate-post.mjs "your topic here"
import fs from "node:fs";

const topic = process.argv.slice(2).join(" ").trim();
if (!topic) { console.error("Provide a topic: node scripts/generate-post.mjs \"topic\""); process.exit(1); }
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Set ANTHROPIC_API_KEY"); process.exit(1); }

const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const file = `blog-${slug}.html`;

const system = `You write SEO blog posts for Twinslytics, a data-engineering agency for ecommerce/DTC revenue teams.
Voice: direct, concrete, no fluff, plain verbs, sentence case. Real specifics over buzzwords.
Output ONLY the inner article content as HTML fragments using ONLY these tags: <p>, <h2>, <ul>, <li>, <strong>, <em>. No <html>, <head>, headings h1, no code fences, no commentary.
Structure: a strong opening hook, then 3-5 <h2> sections with substance, end on a takeaway. 700-1000 words. Under 44-char section headings. Never invent client names or fake statistics.`;

const body = {
  model: "claude-sonnet-5",
  max_tokens: 3000,
  system,
  messages: [{ role: "user", content: `Write the article. Topic: ${topic}` }],
};

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
  body: JSON.stringify(body),
});
const data = await res.json();
const inner = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
if (!inner) { console.error("No content returned:", JSON.stringify(data).slice(0,400)); process.exit(1); }

// derive a title (first <h2> or the topic)
const title = topic.charAt(0).toUpperCase() + topic.slice(1);
const desc = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
const date = new Date().toISOString().slice(0, 10);

const tpl = fs.readFileSync("blog-ga4-roas-lying.html", "utf-8");
// reuse the template's <head>/<style>/header/footer; swap the article body + meta
let html = tpl
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${title} — Twinslytics</title>`)
  .replace(/(name="description" content=")[^"]*(")/, `$1${desc}$2`)
  .replace(/(canonical" href=")[^"]*(")/, `$1https://twinslytics.com/${file}$2`)
  .replace(/(og:url" content=")[^"]*(")/, `$1https://twinslytics.com/${file}$2`)
  .replace(/(og:title" content=")[^"]*(")/, `$1${title}$2`);

// replace the article inner (between <h1> block ... first </article>)
const artStart = html.indexOf('<div class="artmeta">');
const artEnd = html.indexOf('</article>');
const head = html.slice(0, html.indexOf('<h1>'));
const tail = html.slice(artEnd);
html = head +
  `<h1>${title}</h1>\n  <div class="artmeta">${date} · Twinslytics</div>\n\n  ${inner}\n` + tail;

fs.writeFileSync(file, html);
console.log("Wrote", file);

// auto-insert a card into blog.html
const card = `  <a class="post" href="/${file}">
    <div class="tag">Article</div>
    <h3>${title}</h3>
    <p>${desc}</p>
    <div class="meta">${date}</div>
  </a>`;
let blog = fs.readFileSync("blog.html", "utf-8");
if (blog.includes("<!-- POSTS -->")) {
  blog = blog.replace("<!-- POSTS -->", "<!-- POSTS -->\n" + card);
  fs.writeFileSync("blog.html", blog);
  console.log("Added card to blog.html");
}
