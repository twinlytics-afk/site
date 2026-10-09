// Builds /audit: the free 30-minute data audit, the site's low-friction entry
// offer. Same shared shell as the service pages. Run:
//   node scripts/build-audit.mjs && node scripts/sync-blog.mjs
//
// Copy rule (as on the service pages): no invented guarantees. The terms below
// (30 minutes, free, written summary within 3 business days) are the owners'
// commitments, change them here if they change.
import fs from "node:fs";

const SITE = "https://twinslytics.com";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = s => esc(s).replace(/"/g, "&quot;");

const TITLE = "Free revenue data audit";
const DESC = "A free 30-minute audit of your ad tracking, attribution and data pipeline. You get a written summary of the top 3 revenue leaks and what they likely cost.";
const CHECKS = [
  ["Tracking", "Do conversions reach Google Ads and Meta with the right value, source and deduplication?"],
  ["Attribution", "How much revenue lands as direct or the payment domain because UTMs get lost at checkout?"],
  ["ROAS vs. money", "How far is platform-reported ROAS from what your CRM or bank shows after refunds and lag?"],
  ["Pipelines", "Which reports run on stale, broken or silently failing data, and how would you find out?"],
  ["Manual work", "Which recurring tasks (reporting, invoices, order entry) are worth automating first?"],
];
const STEPS = [
  ["Tell us about your setup", "A short form: your site, rough ad spend, and what feels off. Two minutes."],
  ["30-minute call", "We look at your numbers together on a screen share. No access to your accounts needed."],
  ["Written summary", "Within 3 business days: the top 3 leaks, what each likely costs, and the order we'd fix them in."],
];
const FIT = [
  "You run paid ads and your platform numbers don't match your revenue",
  "Reports are built by hand, or nobody trusts the dashboard",
  "Orders, invoices or leads move between systems by copy and paste",
];
const NOTFIT = [
  "You have no ad spend and no data to look at yet",
  "You want a generic SEO or ad-management retainer",
];
const FAQ = [
  ["Is it really free?", "Yes. The call and the written summary cost nothing and don't commit you to anything. If there's a clear fix, we'll say what it would cost, using the ranges on our pricing page."],
  ["What do I need to prepare?", "Nothing beyond the form. If you can open your ad accounts and your CRM or Shopify during the call, we'll go faster, but you stay in control of what's shown."],
  ["Will I get a sales pitch?", "You'll get an honest opinion. If the best fix is a setting change you can make yourself, we'll tell you that."],
  ["Who sees my data?", "Only the two or three people on the call. We don't ask for credentials, and we don't share what you show us."],
  ["What happens after?", "You get the summary and decide. Some teams fix it in-house, some ask us to build it. Both are fine."],
];

const tpl = fs.readFileSync("guide-attribution.html", "utf-8");
const SHELL_HEAD = tpl.slice(tpl.indexOf("<!DOCTYPE html>"), tpl.indexOf("</style>", tpl.indexOf("<style>")));
const SHELL_TOP = tpl.slice(tpl.indexOf("<body>"), tpl.indexOf('<div class="hubwrap">'));
const SHELL_TAIL = tpl.slice(tpl.indexOf("</main>"));

if ((TITLE + " — Twinslytics").length > 60) throw new Error("title too long");
if (DESC.length > 158) throw new Error(`description too long (${DESC.length})`);

const url = `${SITE}/audit`;
const body = `
<section class="sv-hero">
  <span class="crumb"><a href="/">Home</a> / Free audit</span>
  <span class="eyebrow">Free · 30 minutes · no pitch deck</span>
  <h1>Find out where your revenue numbers leak</h1>
  <p>We look at your tracking, attribution and data pipeline with you, then send a written summary of the top 3 leaks and what each likely costs.</p>
  <div class="sv-fact"><b>Free</b> · written summary within 3 business days</div>
</section>

<div class="sv-sec">
  <div class="au-grid">
    <div class="sv-box get au-checks"><h3>What we look at</h3><ul>
      ${CHECKS.map(([k, v]) => `<li><b>${esc(k)}.</b> ${esc(v)}</li>`).join("\n      ")}
    </ul></div>

    <form class="au-form" id="auditForm" action="https://formspree.io/f/xqeryybv" method="POST">
      <h2 id="audit-form">Request your audit</h2>
      <p class="au-sub">We reply within a day to set up the call.</p>
      <label>Name<input type="text" name="name" autocomplete="name" required></label>
      <label>Work email<input type="email" name="email" autocomplete="email" required></label>
      <label>Website<input type="text" name="website" placeholder="yourstore.com" autocomplete="url"></label>
      <label>Monthly ad spend
        <select name="ad_spend">
          <option value="">Select…</option>
          <option>Under $5k</option>
          <option>$5k – $20k</option>
          <option>$20k – $100k</option>
          <option>$100k+</option>
          <option>Not running ads</option>
        </select>
      </label>
      <label>What feels off?<textarea name="problem" rows="3" placeholder="e.g. Meta says 4x ROAS but revenue doesn't match"></textarea></label>
      <input type="hidden" name="source" value="audit_page">
      <button class="btn btn-primary" type="submit">Get my free audit</button>
      <p class="au-fine">No spam, no credentials. Prefer to talk first? <a href="https://cal.com/twinlytics-vcua0p/30min">Book a call directly</a>.</p>
      <p class="au-ok" hidden>Thanks, we'll be in touch within a day to schedule the call.</p>
    </form>
  </div>

  <h2>How it works</h2>
  <div class="au-steps">
    ${STEPS.map(([t, d], i) => `<div class="au-step"><span>${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("\n    ")}
  </div>

  <h2>Is this for you?</h2>
  <div class="sv-two" style="margin-top:8px">
    <div class="sv-box get"><h3>A good fit if</h3><ul>
      ${FIT.map(x => `<li>${esc(x)}</li>`).join("\n      ")}
    </ul></div>
    <div class="sv-box sym"><h3>Probably not if</h3><ul>
      ${NOTFIT.map(x => `<li>${esc(x)}</li>`).join("\n      ")}
    </ul></div>
  </div>

  <h2>Questions</h2>
  <div class="sv-faq" style="margin-top:18px">
    ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n    ")}
  </div>

  <h2>Want to see the work first?</h2>
  <div class="sv-other" style="margin-top:6px">
    <a href="/#work">Case studies</a>
    <a href="/pricing">Pricing</a>
    <a href="/guide-true-roas">Guide: True ROAS</a>
    <a href="/guide-attribution">Guide: Attribution</a>
  </div>
</div>
<div class="sv-end"></div>
<script>
(function () {
  var form = document.getElementById('auditForm');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('bad status');
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: 'generate_lead', lead_source: 'audit_page' });
        Array.prototype.forEach.call(form.children, function (el) { if (!el.classList.contains('au-ok')) el.hidden = true; });
        form.querySelector('.au-ok').hidden = false;
      })
      .catch(function () { btn.disabled = false; alert('Something went wrong. Please email twinslytics@gmail.com'); });
  });
})();
</script>
`;

const head = SHELL_HEAD
  .replace(/<title>.*?<\/title>/, `<title>${esc(TITLE)} — Twinslytics</title>`)
  .replace(/(name="description" content=")[^"]*(")/, (_, a, b) => a + attr(DESC) + b)
  .replace(/(canonical" href=")[^"]*(")/, (_, a, b) => a + url + b)
  .replace(/(og:url" content=")[^"]*(")/, (_, a, b) => a + url + b)
  .replace(/(og:type" content=")[^"]*(")/, (_, a, b) => a + "website" + b)
  .replace(/(og:title" content=")[^"]*(")/, (_, a, b) => a + attr(TITLE) + b)
  .replace(/(og:description" content=")[^"]*(")/, (_, a, b) => a + attr(DESC) + b);

const ld = { "@context": "https://schema.org", "@graph": [
  { "@type": "WebPage", name: TITLE, description: DESC, url },
  { "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  { "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Free audit", item: url } ] },
] };

const page = `${head}</style>\n<link rel="stylesheet" href="/services.css" />\n<script type="application/ld+json">\n${JSON.stringify(ld, null, 1)}\n</script>\n</head>\n${SHELL_TOP}${body}${SHELL_TAIL}`;
fs.writeFileSync("audit.html", page);
console.log(`wrote audit.html (${Math.round(page.length / 1024)} KB)`);
