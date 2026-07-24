# Twinslytics — website

Static site (HTML/CSS/JS, no build step) + blog. Hosted for **$0** on Cloudflare Pages.

## Files
- `index.html` — main site (team photos are embedded, no external images needed)
- `blog.html` — blog listing (has a `<!-- POSTS -->` marker for auto-insert)
- `blog-*.html` — individual articles
- `functions/api/contact.js` — optional Cloudflare Pages Function for the contact form → Slack
- `scripts/generate-post.mjs` — generate a new SEO article with Claude
- `.github/workflows/generate-post.yml` — run the generator on demand from GitHub
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

Cost: only Anthropic API usage per article (cents), and hosting stays $0. The workflow is on-demand (no scheduled spend). To publish weekly automatically, add a `schedule:` cron to the workflow — but on-demand keeps cost and control in your hands.

**Editorial note:** always skim generated drafts before publishing. The generator is told never to invent client names or fake stats, but a human read keeps quality and truth tight — which is the whole SEO play.
