# Twinslytics — website

Static site (HTML/CSS/JS, no build step) + blog. Hosted for **$0** on Cloudflare Pages.

## Files
- `index.html` — main site (team photos are embedded, no external images needed)
- `blog.html` — blog listing (has a `<!-- POSTS -->` marker for auto-insert)
- `blog-*.html` — individual articles
- `guide-*.html` — pillar pages: one hub per topic cluster, linking the posts in it
- `true-roas-calculator.html` — free client-side tool, the page other sites can link to
- `functions/api/contact.js` — optional Cloudflare Pages Function for the contact form → Slack
- `scripts/generate-post.mjs` — generate a new SEO article with Claude
- `scripts/diagram.mjs` — renders article diagrams as inline SVG
- `scripts/gsc.mjs` — reads Search Console (no dependencies)
- `.github/workflows/generate-post.yml` — run the generator on schedule or on demand
- `favicon.svg`, `robots.txt`, `sitemap.xml`, `og.png`

---

## 1. Deploy (Cloudflare Pages — free, commercial use allowed)

1. Create a GitHub repo and push this folder:
   ```
   git init && git add -A && git commit -m "init"
   git branch -M main
   git remote add origin git@github.com:USER/twinslytics.git
   git push -u origin main
   ```
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings: **Framework preset = None**, **Build command = (empty)**, **Output directory = /**. It's plain static.
4. Deploy → you get a `*.pages.dev` preview URL.
5. **Custom domain:** Pages project → Custom domains → add `twinslytics.com` and `www.twinslytics.com`. Point DNS to the records Cloudflare shows (if the domain's DNS is already on Cloudflare, it's one click). SSL is automatic.

Every `git push` now auto-deploys. That's your "change anything, fast" loop.

> Alternative free hosts: **GitHub Pages** (free, commercial OK, but no serverless functions — use Formspree for the form) or **Netlify** (free tier allows commercial). Avoid Vercel Hobby for this — its free tier forbids commercial use, so a business site needs Vercel Pro ($20/mo).

---

## 2. Before going live — replace these placeholders

- **Contact form** (`index.html`, the `<form>` `action`): either
  - keep Formspree: create a form at formspree.io, paste the endpoint over `YOUR_FORM_ID`; or
  - use the built-in function: set `action="/api/contact"`, then in Cloudflare Pages → Settings → Environment variables add `SLACK_WEBHOOK_URL` (an incoming Slack webhook). Leads land in your Slack channel, $0.
- **Booking link:** replace `https://cal.com/twinlytics-vcua0p/30min` with your real Cal.com / Calendly link.
- **Email:** `hello@twinslytics.com` → your inbox.
- **GTM:** paste your `GTM-TB87LC8` container snippet into `<head>` and right after `<body>` on each page so GA4 continuity is kept.
- **Search Console:** verify `twinslytics.com` via DNS TXT (platform-independent), then submit `sitemap.xml`.

---

## 3. Iterate with Claude (fast changes everywhere)

Two ways, both start from the GitHub repo:

**A. Claude Code (recommended for you — you're engineers).**
```
npm install -g @anthropic-ai/claude-code   # check current install command in docs
cd twinslytics
claude
```
Then just ask in plain language: "change the hero headline", "add a case for the parcel-tracking project", "write a new blog post about X". Claude Code edits the files directly; you review, commit, push → auto-deploy.

**B. This chat.** Paste the file or describe the change; I return the edited file; you drop it in and push.

Either way the repo is the single source of truth, so changes propagate everywhere on the next push.

---

## 4. Generate SEO articles automatically

**On demand from your machine:**
```
ANTHROPIC_API_KEY=sk-ant-... node scripts/generate-post.mjs "why offline conversions beat pixel ROAS"
```
It writes `blog-<slug>.html` in the house style and auto-inserts a card into `blog.html`. Review, then `git push`.

**On demand from GitHub (no local setup):**
1. Repo → Settings → Secrets → Actions → add `ANTHROPIC_API_KEY`.
2. Actions tab → "Generate SEO post" → Run workflow → type a topic. It generates the post, commits, and pushes (which auto-deploys).

### How it picks a topic

In order: the CLI argument → the next line of `content/topics.txt` → **Search Console
demand** → whatever Claude proposes. The Search Console step is the useful one: it asks
Google which queries already show the site but rank badly, and writes against that
instead of guessing.

To turn it on:
1. GCP project → enable the **Google Search Console API** → create a service account → JSON key.
2. Search Console → property → Settings → Users and permissions → add the service
   account's `client_email` as a user.
3. Repo → Settings → Secrets → Actions → `GSC_SA_KEY` = the whole JSON.
4. Optional: Settings → Variables → `GSC_SITE_URL` to pin the property explicitly.
   Normally you don't need it — the generator calls `sites.list` and resolves the
   property itself, preferring a Domain property (`sc-domain:twinslytics.com`) over a
   URL prefix (`https://twinslytics.com/`). If it can't match one it fails with the
   list of properties the service account can actually see, which is the fastest way
   to spot a missing permission.

Without `GSC_SA_KEY` the generator still works — it just falls back to proposing its own topic.

### Diagrams

Each post gets one inline SVG diagram. Claude supplies only the labels and values as JSON;
`scripts/diagram.mjs` owns the layout, sizing and palette. A malformed spec means the post
publishes without a diagram rather than with a broken one. Three types: `flow` (pipeline or
chain), `bars` (comparison of magnitudes), `split` (what breaks vs what holds up).

Cost: only Anthropic API usage per article (cents), and hosting stays $0. The workflow is on-demand (no scheduled spend). To publish weekly automatically, add a `schedule:` cron to the workflow — but on-demand keeps cost and control in your hands.

**Editorial note:** always skim generated drafts before publishing. The generator is told never to invent client names or fake stats, but a human read keeps quality and truth tight — which is the whole SEO play.
