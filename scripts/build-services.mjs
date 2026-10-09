// Builds the five service landing pages from the data below, using the site's
// shared page shell. Safe to re-run (overwrites); run scripts/sync-blog.mjs
// afterwards to add the header/footer/dock pieces that every page shares.
//   node scripts/build-services.mjs && node scripts/sync-blog.mjs
//
// Copy rule: every claim on these pages must trace to a case study, the pricing
// page, or the site's own tooling — no invented guarantees or terms.
import fs from "node:fs";
import { readPosts } from "./sync-blog.mjs";

const SITE = "https://twinslytics.com";
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = s => esc(s).replace(/"/g, "&quot;");

// Proof cards. The stats match the cards on the homepage.
const CASES = {
  hourly: { href: "/case-hourly-ad-reporting", tag: "Marketing analytics · Ad reporting", title: "Turned day-old ad reporting into hourly",
    text: "Spend decisions were running up to 30 hours behind. An hourly pipeline across Google Ads, Meta and X, reconciled to the cent against the daily numbers.", stat: "30h → 1h", label: "reporting lag" },
  recon: { href: "/case-ad-spend-reconciliation", tag: "Data engineering · Ad spend", title: "Caught a doubled ad spend line and an $11B phantom revenue bug",
    text: "A daily reconciler between the ad accounts and the warehouse, built to catch silent failures, not just mismatches.", stat: "$6.9k/day", label: "double-counted spend, caught" },
  invoice: { href: "/case-invoice-automation", tag: "AI agent · Finance ops", title: "Turn a chat message into an approved invoice",
    text: "A bot reads a PDF, extracts the line items and routes an ERP invoice for approval before anything is written.", stat: "1 of 5", label: "steps left for a human" },
  campaign: { href: "/case-campaign-launch-automation", tag: "AI agent · Media buying", title: "Automated campaign launches across dozens of countries",
    text: "An agent scans Drive and a spreadsheet and builds the full campaign: paused, logged and one click from live.", stat: "20+", label: "countries, one pipeline" },
  marketplace: { href: "/case-marketplace-automation", tag: "Automation · Marketplaces & ERP", title: "End-to-end order automation across marketplaces and an ERP",
    text: "Orders flow into the ERP, get fulfilled and confirm back automatically, with inventory synced across every channel.", stat: "0", label: "manual order entries" },
  scan: { href: "/case-bigquery-scan-reduction", tag: "Data engineering · BigQuery", title: "Cut a nightly BigQuery scan by 95%",
    text: "Two months of raising the timeout hadn't fixed the failures. The real cause was unpartitioned sources scanning the full history every night.", stat: "−95%", label: "nightly scan, 0 timeouts" },
  seo: { href: "/case-seo-sandbox-recovery", tag: "SEO · Content systems", title: "Took reprolegal.com out of Google's sandbox",
    text: "Built the technical SEO and content system for our own site. It cleared the sandbox and started bringing in inbound leads with zero paid traffic.", stat: "150+", label: "inbound leads, zero ad spend" },
};

const SERVICES = [
  {
    slug: "marketing-analytics", id: "analytics", name: "Marketing analytics & true ROAS", eyebrow: "Service · Marketing analytics",
    seoTitle: "Marketing analytics & true ROAS",
    desc: "Connect your ad platforms, CRM and ERP into one warehouse and measure ROAS against revenue that actually closed. From $2,000, about two weeks.",
    h1: "Marketing analytics that reconcile to closed revenue",
    lede: "Ad platforms report what they claim credit for. We connect them to your CRM and ERP, so you can see what actually closed and optimize on that number.",
    price: "$2,000", term: "~2 weeks", plus: "",
    priceNote: "A natural first step: connect the sources, reconcile ROAS against closed revenue, and see where the platforms disagree with your books. More systems means more scope; the estimator shows the range.",
    symptoms: [
      "Your agency shows three different ROAS numbers from three different tools.",
      "Google Ads and Meta never reconcile once you put them in one spreadsheet.",
      "Platform ROAS says you're winning while your P&L says you lost money.",
      "Reports are a day behind, so budget decisions run on yesterday's numbers.",
    ],
    gets: [
      "Ad platforms, CRM and ERP connected into one warehouse",
      "True ROAS measured against revenue that actually closed, not platform-reported conversions",
      "A report your team opens every day, refreshed hourly in our case study",
      "Closed revenue fed back to the ad platforms, so bidding optimizes on real results",
    ],
    proof: ["hourly", "recon"],
    stack: ["Google Ads", "Meta Ads", "X Ads", "Google Analytics 4", "BigQuery", "dbt", "Looker Studio", "NetSuite", "Shopify"],
    faq: [
      ["What is true ROAS?", "ROAS measured against revenue that actually closed and stayed after refunds, rather than the conversions an ad platform reports about itself. It can come out lower or higher than the platform's figure, and it is the one that matches your accounts."],
      ["Why do ad platforms and my P&L disagree?", "Each platform grades its own homework, with its own attribution window, and none of them sees refunds or offline sales. Reconciling them takes a join you control, in a warehouse, against revenue from your own systems."],
      ["How long does it take?", "A first version of a small setup takes about two weeks. More systems take longer; the estimator on the pricing page shows the range."],
      ["Do we have to change our ad accounts?", "No. The reconciliation only reads from them. If you want, closed revenue can be sent back as conversions, but nothing in the accounts has to change first."],
    ],
    related: [["/guide-true-roas", "Guide"], ["/guide-attribution", "Guide"], ["/true-roas-calculator", "Free tool", "True ROAS calculator"], ["/report", "Live example", "A live report, on sample data"], ["/blog-how-to-reconcile-meta-and-google-roas-against-your-crm", "Article"]],
  },
  {
    slug: "ai-agents-automation", id: "ai-agents", name: "AI agents & automation", eyebrow: "Service · AI agents",
    seoTitle: "AI agents & workflow automation",
    desc: "Chat-based bots and agents that read, decide and act inside Slack, Teams, your ERP or CRM, with a human approving every write. From $4,000, about 3–4 weeks.",
    h1: "AI agents that act inside your tools, with a human in the loop",
    lede: "Bots and ops agents that read the PDF, build the campaign or draft the entry, then wait for a person to approve before anything is written.",
    price: "$4,000", term: "~3–4 weeks", plus: "",
    priceNote: "Covers one well-defined workflow end to end. Each extra system or workflow adds scope; the estimator shows the range.",
    symptoms: [
      "Someone re-keys data from PDFs, emails or chat into the ERP by hand.",
      "A chatbot demo worked on stage and nowhere else.",
      "Campaigns, invoices or reports are assembled manually, with the predictable human errors in names and numbers.",
      "You want software that can act, but nothing should change until a person has approved it.",
    ],
    gets: [
      "An agent or bot inside the chat tool you already use: Slack, Teams or email",
      "Connected to your ERP, CRM or ad platforms, with real lookups so it can't pick something that doesn't exist",
      "An approval step before every write: drafts and paused objects, not live changes",
      "A full audit log, so any run can be traced and reversed",
    ],
    proof: ["invoice", "campaign"],
    stack: ["Slack", "Microsoft Teams", "Document AI", "Google Drive & Sheets", "Google Ads", "Meta Ads", "X Ads", "BigQuery", "NetSuite", "SAP", "QuickBooks"],
    faq: [
      ["What stops an agent doing something wrong?", "Nothing is written until a person approves it. Campaigns are created paused, invoices wait for sign-off, and every API call is logged so a run can be traced and reversed."],
      ["How is this different from a chatbot?", "A chatbot answers questions. These agents act in your systems: they read a document, look up real records and create the entry or campaign for approval."],
      ["Can it read PDFs and emails?", "Yes. In our invoice case a document-AI step extracts the vendor and line items from an uploaded PDF into a pre-filled form."],
      ["Which chat tools and ERPs does it work with?", "We built the invoice bot on Slack, and it works the same on Teams. The method is the same on NetSuite, SAP, QuickBooks and most other ERPs; what changes is the connector."],
    ],
    related: [["/blog-build-an-ai-agent-that-allocates-ad-spend-by-contribution-ma", "Article"], ["/blog-build-an-ai-agent-that-flags-creative-fatigue-before-roas-dr", "Article"], ["/blog-what-ai-ready-data-actually-means-a-practical-checklist", "Article"]],
  },
  {
    slug: "marketplace-erp-integration", id: "marketplace-erp", name: "Marketplace & ERP integration", eyebrow: "Service · Integrations",
    seoTitle: "Marketplace & ERP integration",
    desc: "Connect retail marketplaces to your ERP: orders in, shipments confirmed back, inventory in sync, alerts on failures. From $5,000, about 4 weeks.",
    h1: "Marketplace and ERP integration that closes the order-to-shipment loop",
    lede: "Orders flow from the marketplace into your ERP, fulfilment confirms back, and stock stays in sync, without anyone re-keying a thing.",
    price: "$5,000", term: "~4 weeks", plus: "",
    priceNote: "Covers one marketplace connected to one ERP. Adding a second marketplace is faster, because the same architecture is reused.",
    symptoms: [
      "Marketplace orders are keyed into the ERP by hand.",
      "Shipment confirmations reach the marketplace days late.",
      "Inventory is updated by hand across channels, and you oversell.",
      "An integration broke quietly and nobody noticed until a customer complained.",
    ],
    gets: [
      "Marketplace orders pulled in, checked against your product catalog and created as sales orders in the ERP",
      "Shipping documents generated and sent to the warehouse automatically",
      "Fulfilment detected in the ERP and confirmed back to the marketplace",
      "Inventory kept in sync across every channel, with monitoring and alerts on failures",
    ],
    proof: ["marketplace"],
    stack: ["NetSuite", "SAP", "Oracle", "Odoo", "Shopify", "Cloud Run", "Cloud Scheduler", "BigQuery"],
    faq: [
      ["Which marketplaces and ERPs do you work with?", "The approach is the same on NetSuite, SAP, Oracle, Odoo and others; what changes is the connector. If a system's API is a poor fit, we say so up front."],
      ["How do you stop bad data reaching a live listing?", "Every change is tested against a sandbox first. In our case study that caught a validation gap that would have put the wrong product image on a live listing."],
      ["What happens when something fails?", "Failures are logged and alerted, and orders aren't silently dropped. You see which order or file failed, so the fix starts at the cause."],
      ["How long does it take to add another marketplace?", "Less than the first one. In our case study the second marketplace was onboarded in a fraction of the time, because the architecture was reused."],
    ],
    related: [["/guide-data-pipelines", "Guide"], ["/blog-monitoring-and-alerting-for-data-pipelines-in-production", "Article"], ["/blog-when-to-move-from-spreadsheets-to-a-data-warehouse", "Article"]],
  },
  {
    slug: "data-engineering", id: "data-engineering", name: "Data engineering & pipeline reliability", eyebrow: "Service · Data engineering",
    seoTitle: "Data engineering & pipeline reliability",
    desc: "Pipelines and warehouses that fail loudly: we find where cost and failures come from, fix them, and reconcile reports to the source. From $4,000.",
    h1: "Data engineering that fails loudly instead of silently",
    lede: "Fewer nightly failures, a smaller warehouse bill, and reports reconciled against the source of truth, so a quiet disagreement never costs you a decision.",
    price: "$4,000", term: "~3 weeks", plus: "",
    priceNote: "Covers a focused review and fix of one pipeline or one area of the warehouse. Larger estates take longer; the estimator shows the range.",
    symptoms: [
      "The nightly job fails on a different model every night, and raising the timeout never fixes it.",
      "The warehouse bill keeps growing and nobody can say why.",
      "The dashboard shows one number and the ad account another, and nobody knows which is right.",
      "A connector silently stopped, and the report showed zero.",
    ],
    gets: [
      "A review of your pipelines and warehouse that measures where cost and failures actually come from",
      "Structural fixes, verified by comparing values, not just row counts",
      "A daily reconciliation between your source of truth and your reports, including silent failures",
      "Alerts that name the failing file or row, so the fix starts at the cause",
    ],
    proof: ["scan", "recon"],
    stack: ["BigQuery", "dbt", "Cloud Run", "Cloud Scheduler", "Python", "Slack alerts", "Google Ads API", "Meta Graph API", "Google Analytics 4"],
    faq: [
      ["Do you only work with BigQuery and dbt?", "Our case work is on BigQuery and dbt. On another warehouse the diagnostic method carries over, and we'll tell you honestly where our experience is thinner."],
      ["Why didn't raising the timeout fix our failing job?", "Usually the timeout is a symptom. In our case study nothing was partitioned, so every model rescanned the full history each night and heavy models competed for slots. Measuring the scan per model showed the real cause."],
      ["How do you know a fix didn't change the data?", "We compare values, not only row counts, and diff the compiled SQL before and after every change."],
      ["What is a reconciler?", "A daily check that compares what the source system says against what your report says, per entity, and alerts on any disagreement. It includes the case where both sides show zero, which a simple total would read as healthy."],
    ],
    related: [["/guide-data-pipelines", "Guide"], ["/blog-why-your-dbt-pipeline-keeps-breaking-on-api-schema-drift", "Article"], ["/blog-monitoring-and-alerting-for-data-pipelines-in-production", "Article"], ["/blog-how-to-build-a-self-healing-dbt-pipeline-for-ecommerce-data-", "Article"]],
  },
  {
    slug: "seo-systems", id: "seo-systems", name: "SEO systems & content operations", eyebrow: "Service · SEO systems",
    seoTitle: "SEO systems & content operations",
    desc: "Technical SEO, topics chosen from real Search Console queries, pages published on a schedule, and bulk edits across site networks. From $3,000 + monthly.",
    h1: "SEO systems that publish on a schedule and compound",
    lede: "Technical SEO, a content structure built around how buyers actually search, and automation that ships pages without waiting for someone to remember.",
    price: "$3,000", term: "setup, then monthly", plus: "+ monthly",
    priceNote: "The setup covers the technical foundation and content structure; the monthly part covers the ongoing publishing system. Scope depends on site size and on how many sites are involved.",
    symptoms: [
      "A new site that Google isn't ranking, months in, with nothing happening.",
      "Content gets written whenever someone has time, so it never compounds.",
      "You run a network of sites and every title, image or partner change is done page by page.",
      "Pages exist, but none of them targets the way your buyers actually search.",
    ],
    gets: [
      "Technical SEO foundations: canonical tags, sitemap, structured data and a speed budget",
      "A content structure with pages for the decisions your buyers are making, not just generic articles",
      "Topics chosen from the queries Google already shows your site for, using Search Console",
      "Automation that publishes on a schedule, plus bulk edits across a whole network of sites",
    ],
    proof: ["seo"],
    stack: ["Google Search Console", "Google Analytics 4", "Any CMS or static site", "Structured data", "Sitemaps"],
    faq: [
      ["How long until we rank?", "It varies. A new domain can sit in Google's sandbox for months, and nobody can promise a date. The system's job is to make steady, correctly targeted progress while that clock runs, as it did for our own site."],
      ["Do you write the content?", "We build the pipeline that drafts and publishes pages from real search demand. How much human review sits in front of publishing is your call."],
      ["Can you work on an existing site?", "Yes. Much of the value comes from fixing what's already there: structure, titles, and the pages that rank but don't get clicked."],
      ["Can you manage several sites at once?", "Yes. Bulk edits to titles, images, copy and partner references can be applied across a network of sites in one pass, instead of page by page."],
    ],
    related: [["/pricing#seo-systems", "Pricing", "What an SEO system costs, and what moves the price"]],
  },
];

// ---- shell: reuse the shared head/header/footer from an existing page ----
const tpl = fs.readFileSync("guide-attribution.html", "utf-8");
const SHELL_HEAD = tpl.slice(tpl.indexOf("<!DOCTYPE html>"), tpl.indexOf("</style>", tpl.indexOf("<style>")));
const SHELL_TOP = tpl.slice(tpl.indexOf("<body>"), tpl.indexOf('<div class="hubwrap">'));
const SHELL_TAIL = tpl.slice(tpl.indexOf("</main>"));

const posts = Object.fromEntries(readPosts().map(p => [`/${p.file.replace(/\.html$/, "")}`, p.title]));
const GUIDE_TITLES = { "/guide-true-roas": "True ROAS: measuring ad spend against closed revenue", "/guide-attribution": "Marketing attribution for ecommerce", "/guide-data-pipelines": "Revenue pipelines that survive production" };

function relatedItem([href, kind, title]) {
  const path = href.split("#")[0];
  const t = title || posts[path] || GUIDE_TITLES[path];
  if (!t) throw new Error(`no title for related link ${href}`);
  return `<a href="${href}"><span class="k">${esc(kind)}</span><span class="t">${esc(t)}</span></a>`;
}

function build(s) {
  // Search results cut titles near 60 characters and descriptions near 158.
  if ((s.seoTitle + " — Twinslytics").length > 60) throw new Error(`${s.slug}: title too long (${(s.seoTitle + " — Twinslytics").length})`);
  if (s.desc.length > 158) throw new Error(`${s.slug}: description too long (${s.desc.length})`);
  const url = `${SITE}/${s.slug}`;
  const proofHtml = s.proof.map(k => { const c = CASES[k];
    return `<a class="sv-pcard" href="${c.href}"><div class="tag">${esc(c.tag)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p><div class="stat"><b>${esc(c.stat)}</b><span>${esc(c.label)}</span></div><span class="go">Read the case study →</span></a>`; }).join("\n      ");
  const others = SERVICES.filter(o => o.slug !== s.slug).map(o => `<a href="/${o.slug}">${esc(o.name)}</a>`).join("\n      ");
  const faqHtml = s.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n    ");
  const fact = `<b>From ${s.price}${s.plus ? " " + s.plus : ""}</b> · ${esc(s.term)}`;

  const body = `
<section class="sv-hero">
  <span class="crumb"><a href="/#services">Services</a> / ${esc(s.name)}</span>
  <span class="eyebrow">${esc(s.eyebrow)}</span>
  <h1>${esc(s.h1)}</h1>
  <p>${esc(s.lede)}</p>
  <div class="sv-cta">
    <a class="btn btn-primary" href="/pricing#${s.id}">Get an estimate</a>
    <a class="btn btn-secondary" href="/#contact">Book a call</a>
  </div>
  <div class="sv-fact">${fact}</div>
</section>

<div class="sv-sec">
  <div class="sv-two" style="margin-top:8px">
    <div class="sv-box sym"><h3>Sounds familiar?</h3><ul>
      ${s.symptoms.map(x => `<li>${esc(x)}</li>`).join("\n      ")}
    </ul></div>
    <div class="sv-box get"><h3>What you get</h3><ul>
      ${s.gets.map(x => `<li>${esc(x)}</li>`).join("\n      ")}
    </ul></div>
  </div>

  <h2>Proof it works</h2>
  <p class="sub">Real engagements, with the clients anonymized.</p>
  <div class="sv-proof">
      ${proofHtml}
  </div>

  <h2>Price and timeline</h2>
  <div class="sv-price">
    <div><div class="from">From</div><div class="amt">${s.price}</div>${s.plus ? `<div class="plus">${esc(s.plus)}</div>` : `<div class="plus">${esc(s.term)}</div>`}</div>
    <div class="txt"><b>${esc(s.term === "setup, then monthly" ? "Setup, then a monthly retainer." : "Typically " + s.term + ".")}</b> ${esc(s.priceNote)}</div>
    <a class="btn btn-primary" href="/pricing#${s.id}">Open the estimator</a>
  </div>

  <h2>Works with your stack</h2>
  <p class="sub">The method stays the same; the connector changes.</p>
  <div class="sv-chips">${s.stack.map(c => `<span class="sv-chip">${esc(c)}</span>`).join("")}</div>

  <h2>Questions</h2>
  <div class="sv-faq" style="margin-top:18px">
    ${faqHtml}
  </div>

  <h2>Keep reading</h2>
  <div class="sv-rel" style="margin-top:6px">
    ${s.related.map(relatedItem).join("\n    ")}
  </div>

  <h2>Other services</h2>
  <div class="sv-other" style="margin-top:6px">
      ${others}
  </div>
</div>

<div class="sv-end">
  <div class="endcta" style="margin:0 auto">
    <div class="ctaproof">From ${s.price}${s.plus ? " " + s.plus : ""} · ${esc(s.term)}</div>
    <h3>Want to see where you'd land?</h3>
    <p>Tell us what hurts and we'll say honestly whether we're the right fit, and what it would cost.</p>
    <div class="ctabtns">
      <a href="/pricing#${s.id}" class="btn btn-secondary">Get an estimate</a>
      <a href="/#contact" class="btn btn-primary">Book a call</a>
    </div>
  </div>
</div>
`;

  const head = SHELL_HEAD
    .replace(/<title>.*?<\/title>/, `<title>${esc(s.seoTitle)} — Twinslytics</title>`)
    .replace(/(name="description" content=")[^"]*(")/, (_, a, b) => a + attr(s.desc) + b)
    .replace(/(canonical" href=")[^"]*(")/, (_, a, b) => a + url + b)
    .replace(/(og:url" content=")[^"]*(")/, (_, a, b) => a + url + b)
    .replace(/(og:type" content=")[^"]*(")/, (_, a, b) => a + "website" + b)
    .replace(/(og:title" content=")[^"]*(")/, (_, a, b) => a + attr(s.seoTitle) + b)
    .replace(/(og:description" content=")[^"]*(")/, (_, a, b) => a + attr(s.desc) + b);

  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "Service", name: s.name, serviceType: s.name, description: s.desc, url,
      provider: { "@type": "Organization", name: "Twinslytics", url: SITE },
      offers: { "@type": "Offer", priceCurrency: "USD", priceSpecification: { "@type": "PriceSpecification", minPrice: Number(s.price.replace(/\D/g, "")), priceCurrency: "USD" } } },
    { "@type": "FAQPage", mainEntity: s.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Services", item: `${SITE}/#services` },
      { "@type": "ListItem", position: 3, name: s.name, item: url } ] },
  ] };

  const page = `${head}</style>\n<link rel="stylesheet" href="/services.css" />\n<script type="application/ld+json">\n${JSON.stringify(ld, null, 1)}\n</script>\n</head>\n${SHELL_TOP}${body}${SHELL_TAIL}`;
  fs.writeFileSync(`${s.slug}.html`, page);
  console.log(`wrote ${s.slug}.html (${Math.round(page.length / 1024)} KB)`);
}

SERVICES.forEach(build);
export { SERVICES };
