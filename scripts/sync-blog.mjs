// Rebuild everything that lists posts from the posts themselves, so nothing
// drifts: the blog grid (with category filters), each guide's "Read next"
// list, the article counts on the "Start here" cards, and the site footer and
// contact dock script on every page. Idempotent; safe to run after every new post.
//   node scripts/sync-blog.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const CATS = ["Attribution", "Marketing analytics", "Data engineering", "AI & automation"];

// Every post links up to its pillar guide, and every guide lists its posts.
export const PILLARS = {
  "Attribution": ["guide-attribution.html", "Guide: Marketing attribution for ecommerce"],
  "Marketing analytics": ["guide-true-roas.html", "Guide: True ROAS, and how to get to it"],
  "Data engineering": ["guide-data-pipelines.html", "Guide: Revenue pipelines that survive production"],
  "AI & automation": ["guide-data-pipelines.html", "Guide: Revenue pipelines that survive production"],
};

// Older generator runs left lowercase acronyms in titles ("blended roas").
const ACRONYMS = ["ROAS", "LTV", "CAC", "UTM", "CAPI", "GA4", "CRM", "DTC", "MMM", "API", "SEO", "AI", "ML", "KPI"];
export function fixAcronyms(s) {
  let out = s;
  for (const a of ACRONYMS) out = out.replace(new RegExp(`\\b${a}\\b`, "gi"), a);
  return out.replace(/\bios\b/gi, "iOS").replace(/\bdbt\b/gi, "dbt");
}

export const slugOf = cat => cat.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = s => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const stripTags = s => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const noExt = f => f.replace(/\.html$/, "");
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function readPosts(dir = ".") {
  return fs.readdirSync(dir).filter(f => /^blog-.+\.html$/.test(f)).map(f => {
    const s = fs.readFileSync(`${dir}/${f}`, "utf-8");
    const title = unesc(stripTags((s.match(/<h1>([\s\S]*?)<\/h1>/) || [, f])[1]));
    const rawCat = unesc((s.match(/eyebrow">([^<]*)<\/span>/) || [, "Data engineering"])[1].trim());
    const category = CATS.includes(rawCat) ? rawCat : "Data engineering";
    const iso = (s.match(/"datePublished":"([^"]+)"/) || [, "1970-01-01"])[1];
    const d = new Date(iso + "T00:00:00Z");
    const mins = (s.match(/class="artmeta">[^<]*?(\d+) min read/) || [, "5"])[1];
    const desc = unesc((s.match(/name="description" content="([^"]*)"/) || [, ""])[1]);
    return { file: f, title, category, iso, date: `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`, mins, desc };
  }).sort((a, b) => b.iso.localeCompare(a.iso) || a.file.localeCompare(b.file));
}

// Rewrites the title fields of a post in place when acronyms are wrong.
function normalizePostTitle(file) {
  const s = fs.readFileSync(file, "utf-8");
  const h1 = (s.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1];
  if (!h1) return false;
  const fixed = fixAcronyms(h1);
  if (fixed === h1) return false;
  // Same string appears in <title>, og:title, headline and the breadcrumb.
  fs.writeFileSync(file, s.split(h1).join(fixed));
  return true;
}

function card(p) {
  return `  <a class="post" data-cat="${slugOf(p.category)}" href="/${noExt(p.file)}">
    <div class="tag">${esc(p.category)}</div>
    <h3>${esc(p.title)}</h3>
    <p>${esc(p.desc)}</p>
    <div class="meta">${p.date} · ${p.mins} min read<span class="views" data-p="/${p.file}"></span></div>
  </a>`;
}

function syncBlog(posts) {
  let blog = fs.readFileSync("blog.html", "utf-8");
  const counts = Object.fromEntries(CATS.map(c => [c, posts.filter(p => p.category === c).length]));
  const tabs = [`    <button type="button" class="ftab is-on" data-f="all">All <span>${posts.length}</span></button>`,
    ...CATS.map(c => `    <button type="button" class="ftab" data-f="${slugOf(c)}">${esc(c)} <span>${counts[c]}</span></button>`)];
  const filters = `<!-- FILTERS -->\n  <div class="filters" role="toolbar" aria-label="Filter by topic">\n${tabs.join("\n")}\n  </div>\n<!-- /FILTERS -->`;
  blog = blog.replace(/<!-- FILTERS -->[\s\S]*?<!-- \/FILTERS -->/, filters);
  const grid = `<!-- POSTS -->\n${posts.map(card).join("\n")}\n  <!-- /POSTS -->`;
  blog = blog.replace(/<!-- POSTS -->[\s\S]*?<!-- \/POSTS -->/, grid);

  // Article counts on the "Start here" cards.
  for (const guide of new Set(Object.values(PILLARS).map(v => v[0]))) {
    const n = posts.filter(p => PILLARS[p.category][0] === guide).length;
    blog = blog.replace(new RegExp(`(href="/${noExt(guide)}"[\\s\\S]*?<span class="gcount">)[^<]*(</span>)`), `$1${n} articles →$2`);
  }
  fs.writeFileSync("blog.html", blog);
}

// Keeps hand-written blurbs already in a guide; new posts get their meta description.
function syncGuide(guide, posts) {
  let html = fs.readFileSync(guide, "utf-8");
  const re = /<!-- READLIST -->[\s\S]*?<!-- \/READLIST -->/;
  if (!re.test(html)) return;
  const blurbs = {};
  for (const m of html.matchAll(/<a class="readitem" href="\/([^"]+)">[\s\S]*?<p>([\s\S]*?)<\/p>/g)) blurbs[m[1]] = m[2];
  const cats = CATS.filter(c => PILLARS[c][0] === guide);
  const groups = cats.map(c => {
    const items = posts.filter(p => p.category === c).map(p => `    <a class="readitem" href="/${noExt(p.file)}">
      <span class="rtag">${esc(p.category)}</span>
      <h3>${esc(p.title)}</h3>
      <p>${blurbs[noExt(p.file)] || esc(p.desc)}</p>
    </a>`);
    if (!items.length) return "";
    const head = cats.length > 1 ? `  <div class="readgroup">${esc(c)}</div>\n` : "";
    return `${head}  <div class="readlist">\n${items.join("\n")}\n  </div>`;
  }).filter(Boolean);
  html = html.replace(re, `<!-- READLIST -->\n${groups.join("\n")}\n  <!-- /READLIST -->`);
  fs.writeFileSync(guide, html);
}

const DOCK = '<script src="/dock.js" defer></script>';
function ensureDock(file) {
  const s = fs.readFileSync(file, "utf-8");
  if (s.includes(DOCK) || !s.includes("</body>")) return;
  fs.writeFileSync(file, s.replace("</body>", `${DOCK}\n</body>`));
}

// One footer for the whole site. Real links (not JS) so crawlers follow them
// to the guides and tools from every page.
const FOOTER_T = {
  en: { home: "/", tag: "Data infrastructure that drives revenue. Two engineers, no handoffs.", cta: "Book a call",
    company: "Company", work: "Work", services: "Services", team: "Team", contact: "Contact",
    resources: "Resources", blog: "Blog", report: "Live report example", calc: "True ROAS calculator",
    reach: "Get in touch" },
  uk: { home: "/ua", tag: "Дата-інфраструктура, що приносить гроші. Два інженери, без посередників.", cta: "Замовити дзвінок",
    company: "Компанія", work: "Кейси", services: "Послуги", team: "Команда", contact: "Контакти",
    resources: "Матеріали", blog: "Блог", report: "Приклад звіту", calc: "Калькулятор True ROAS",
    reach: "Звʼязатися" },
};
function footerHtml(lang) {
  const t = FOOTER_T[lang] || FOOTER_T.en;
  const h = t.home;
  const langsw = lang === "uk"
    ? `<a href="/">EN</a> / <span class="on">UA</span>`
    : `<span class="on">EN</span> / <a href="/ua">UA</a>`;
  return `<footer class="sf">
  <div class="sf-in">
    <div class="sf-grid">
      <div class="sf-brand">
        <a class="sf-logo" href="${h}"><img src="/logo-icon.png" alt="" width="48" height="24" loading="lazy" />Twinslytics</a>
        <p>${t.tag}</p>
        <a class="sf-cta" href="${h}#contact">${t.cta}</a>
      </div>
      <div>
        <h4>${t.company}</h4>
        <ul>
          <li><a href="${h}#work">${t.work}</a></li>
          <li><a href="${h}#services">${t.services}</a></li>
          <li><a href="${h}#team">${t.team}</a></li>
          <li><a href="${h}#contact">${t.contact}</a></li>
        </ul>
      </div>
      <div>
        <h4>${t.resources}</h4>
        <ul>
          <li><a href="/blog">${t.blog}</a></li>
          <li><a href="/guide-attribution">Attribution guide</a></li>
          <li><a href="/guide-true-roas">True ROAS guide</a></li>
          <li><a href="/guide-data-pipelines">Data pipelines guide</a></li>
          <li><a href="/true-roas-calculator">${t.calc}</a></li>
          <li><a href="/report">${t.report}</a></li>
        </ul>
      </div>
      <div>
        <h4>${t.reach}</h4>
        <ul>
          <li><a href="mailto:twinslytics@gmail.com">twinslytics@gmail.com</a></li>
          <li><a href="https://t.me/vhalstian" target="_blank" rel="noopener">Telegram</a></li>
          <li><a href="https://www.linkedin.com/in/vladislav-halstyan-03586b131/" target="_blank" rel="noopener">LinkedIn</a></li>
          <li><a href="tel:+380956162210">+380 95 616 2210</a></li>
        </ul>
      </div>
    </div>
    <div class="sf-bottom">
      <span>© <span id="yr">${new Date().getFullYear()}</span> Twinslytics</span>
      <span>${langsw}</span>
    </div>
  </div>
</footer>`;
}
const FOOTER_CSS = '<link rel="stylesheet" href="/footer.css" />';
function ensureFooter(file) {
  let s = fs.readFileSync(file, "utf-8");
  if (!/<footer[\s>]/.test(s)) return;
  const lang = (s.match(/<html lang="([a-z]+)/) || [, "en"])[1];
  const next = s.replace(/<footer[\s\S]*?<\/footer>/, footerHtml(lang));
  s = next.includes(FOOTER_CSS) ? next : next.replace("</head>", `${FOOTER_CSS}\n</head>`);
  fs.writeFileSync(file, s);
}

export function sync() {
  const fixed = fs.readdirSync(".").filter(f => /^blog-.+\.html$/.test(f)).filter(normalizePostTitle);
  if (fixed.length) console.log("Titles fixed:", fixed.join(", "));
  const posts = readPosts();
  syncBlog(posts);
  for (const g of new Set(Object.values(PILLARS).map(v => v[0]))) syncGuide(g, posts);
  for (const f of fs.readdirSync(".").filter(f => f.endsWith(".html"))) { ensureDock(f); ensureFooter(f); }
  console.log(`Synced ${posts.length} posts.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) sync();
