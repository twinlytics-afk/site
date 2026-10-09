// What Google Search Console says about the site, and what the post generator
// will see. Run any time:
//   node scripts/gsc-report.mjs            (needs GSC_SA_KEY or GSC_ACCESS_TOKEN)
//   node scripts/gsc-report.mjs 28         (window in days, default 90)
import { fetchQueries, fetchSummary, opportunities, quickWins } from "./gsc.mjs";

const days = Number(process.argv[2]) || 90;
const pct = x => (x * 100).toFixed(2) + "%";
const row = (n, ...cells) => String(n).padStart(5) + "  " + cells.join("  ");

const summary = await fetchSummary({ days });
if (!summary) {
  console.error("No credentials. Set GSC_SA_KEY (service-account JSON) or GSC_ACCESS_TOKEN.");
  process.exit(1);
}

const { window: w, totals, pages } = summary;
console.log(`\nWindow ${w.startDate} .. ${w.endDate}`);
if (totals) {
  console.log(`Totals: ${totals.clicks} clicks, ${totals.impressions} impressions, CTR ${pct(totals.ctr)}, avg position ${totals.position.toFixed(1)}`);
}

console.log("\nTOP PAGES (impressions · clicks · position)");
for (const p of pages.slice(0, 12)) {
  console.log(row(p.impressions, `${String(p.clicks).padStart(3)} clk`, `pos ${p.position.toFixed(1).padStart(5)}`, p.page));
}

const rows = await fetchQueries({ days, withPages: true });
const visible = rows.reduce((n, r) => n + r.impressions, 0);
console.log(`\n${rows.length} queries visible, covering ${visible} of ${totals?.impressions ?? "?"} impressions` +
  " (Google hides the rest as anonymized).");

const opp = opportunities(rows);
console.log(`\nNEW-ARTICLE CANDIDATES — ${opp.length} queries where we rank on page 2+ (what the generator sees)`);
for (const r of opp.slice(0, 25)) {
  const top = r.pages[0];
  const ours = top ? `${top.page} @ ${top.position.toFixed(1)}` : "no page of ours";
  console.log(row(r.impressions, `pos ${r.position.toFixed(1).padStart(5)}`, r.query.slice(0, 70).padEnd(70), "→", ours));
}
console.log("");

const wins = quickWins(rows);
console.log(`QUICK WINS — ${wins.length} page-1 queries: sharpen the ranking page's title/meta/intro, don't write a new post`);
for (const r of wins) {
  const top = r.pages[0];
  console.log(row(r.impressions, `pos ${r.position.toFixed(1).padStart(5)}`, r.query.slice(0, 70).padEnd(70), "→", top ? top.page : "?"));
}
console.log("");
