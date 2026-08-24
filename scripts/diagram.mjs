// Renders article diagrams as inline SVG in the site's palette.
// The model only supplies content (labels/values); layout and styling live here,
// so a bad generation degrades to "no diagram" instead of a broken-looking one.

const INK = "#14122b", BODY = "#403c5c", MUT = "#918da8";
const LINE = "#ece7f6", V = "#6c4cf0", OK = "#12b981", WARN = "#ff7a59";
const DISP = "'Space Grotesk',system-ui,sans-serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clamp = (s, n) => { s = String(s).trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s; };

// Greedy wrap into at most `maxLines` lines of ~`per` chars, ellipsising the overflow.
function wrap(text, per, maxLines) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (next.length <= per) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    if (lines.length === maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length > maxLines) lines.length = maxLines;
  const used = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (used < words.length && lines.length) {
    lines[lines.length - 1] = clamp(lines[lines.length - 1] + " …", per);
  }
  return lines;
}

function svgOpen(w, h, title) {
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" role="img" `
    + `aria-label="${esc(title)}" xmlns="http://www.w3.org/2000/svg" `
    + `style="display:block;max-width:100%;height:auto">`;
}

// Horizontal stage flow: pipeline / attribution chain. 3-4 stages.
// Capped at 4 because a 5th box leaves too little width for a legible label.
function flow(d) {
  const items = d.items.slice(0, 4);
  const n = items.length;
  const W = 720, padX = 8, gapArrow = 34;
  const boxW = Math.floor((W - padX * 2 - gapArrow * (n - 1)) / n);
  const inner = boxW - 30;
  const perLabel = Math.max(8, Math.floor(inner / 7.4));
  const perNote = Math.max(10, Math.floor(inner / 5.9));
  const boxH = 96, top = 46, H = top + boxH + 34;
  let s = svgOpen(W, H, d.title || "Diagram");

  if (d.title) {
    s += `<text x="${padX}" y="24" font-family="${DISP}" font-size="15" font-weight="600" fill="${INK}">${esc(clamp(d.title, 72))}</text>`;
  }
  s += `<defs><marker id="dgArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">`
    + `<path d="M0,1 L9,5 L0,9 z" fill="${MUT}"/></marker></defs>`;

  items.forEach((it, i) => {
    const x = padX + i * (boxW + gapArrow);
    const accent = i === n - 1 ? OK : V;
    s += `<rect x="${x}" y="${top}" width="${boxW}" height="${boxH}" rx="11" fill="#faf8ff" stroke="${LINE}"/>`;
    s += `<rect x="${x}" y="${top}" width="3.5" height="${boxH}" rx="2" fill="${accent}"/>`;
    s += `<text x="${x + 15}" y="${top + 25}" font-family="${MONO}" font-size="10" letter-spacing="1.4" fill="${accent}">${esc(String(i + 1).padStart(2, "0"))}</text>`;
    wrap(it.label || "", perLabel, 2).forEach((ln, k) => {
      s += `<text x="${x + 15}" y="${top + 47 + k * 17}" font-family="${DISP}" font-size="13.5" font-weight="600" fill="${INK}">${esc(ln)}</text>`;
    });
    if (it.note) {
      wrap(it.note, perNote, 1).forEach(ln => {
        s += `<text x="${x + 15}" y="${top + 83}" font-family="${DISP}" font-size="11.5" fill="${MUT}">${esc(ln)}</text>`;
      });
    }
    if (i < n - 1) {
      const ax = x + boxW + 7, ay = top + boxH / 2;
      s += `<line x1="${ax}" y1="${ay}" x2="${ax + gapArrow - 14}" y2="${ay}" stroke="${MUT}" stroke-width="1.6" marker-end="url(#dgArrow)"/>`;
    }
  });
  return s + "</svg>";
}

// Labeled horizontal bars: reported vs true, before vs after. 2-5 bars.
function bars(d) {
  const items = d.items.slice(0, 5).map(it => ({ ...it, value: Number(it.value) }))
    .filter(it => Number.isFinite(it.value));
  if (items.length < 2) return null;
  const max = Math.max(...items.map(i => Math.abs(i.value))) || 1;
  const W = 720, padX = 8, labelW = 232, valueW = 92;
  const trackX = padX + labelW, trackW = W - padX * 2 - labelW - valueW;
  const rowH = 46, top = d.title ? 44 : 10;
  const H = top + items.length * rowH + 8;
  let s = svgOpen(W, H, d.title || "Comparison");

  if (d.title) {
    s += `<text x="${padX}" y="24" font-family="${DISP}" font-size="15" font-weight="600" fill="${INK}">${esc(clamp(d.title, 72))}</text>`;
  }
  items.forEach((it, i) => {
    const y = top + i * rowH;
    const barH = 20, by = y + 9;
    const w = Math.max(3, Math.round(Math.abs(it.value) / max * trackW));
    const fill = it.highlight ? V : (i === 0 ? WARN : "#c9bdf5");
    s += `<text x="${padX}" y="${by + 15}" font-family="${DISP}" font-size="12.5" fill="${BODY}">${esc(clamp(it.label || "", 29))}</text>`;
    s += `<rect x="${trackX}" y="${by}" width="${trackW}" height="${barH}" rx="6" fill="#f6f3fd"/>`;
    s += `<rect x="${trackX}" y="${by}" width="${w}" height="${barH}" rx="6" fill="${fill}"/>`;
    s += `<text x="${trackX + trackW + 12}" y="${by + 15}" font-family="${MONO}" font-size="12.5" font-weight="500" fill="${INK}">${esc(clamp(it.display || it.value, 12))}</text>`;
  });
  return s + "</svg>";
}

// Two-column contrast: what breaks vs what fixes it.
function split(d) {
  const L = d.left || {}, R = d.right || {};
  const li = (L.items || []).slice(0, 4), ri = (R.items || []).slice(0, 4);
  if (!li.length || !ri.length) return null;
  const rows = Math.max(li.length, ri.length);
  const W = 720, padX = 8, gap = 20;
  const colW = Math.floor((W - padX * 2 - gap) / 2);
  const top = d.title ? 44 : 10;
  const headH = 40, rowH = 30;
  const boxH = headH + rows * rowH + 14;
  const H = top + boxH + 6;
  let s = svgOpen(W, H, d.title || "Comparison");

  if (d.title) {
    s += `<text x="${padX}" y="24" font-family="${DISP}" font-size="15" font-weight="600" fill="${INK}">${esc(clamp(d.title, 72))}</text>`;
  }
  [[L, li, WARN, padX], [R, ri, OK, padX + colW + gap]].forEach(([col, items, accent, x]) => {
    s += `<rect x="${x}" y="${top}" width="${colW}" height="${boxH}" rx="12" fill="#fdfcff" stroke="${LINE}"/>`;
    s += `<text x="${x + 16}" y="${top + 25}" font-family="${MONO}" font-size="10.5" letter-spacing="1.3" fill="${accent}">${esc(clamp((col.heading || "").toUpperCase(), 26))}</text>`;
    s += `<line x1="${x + 16}" y1="${top + headH - 4}" x2="${x + colW - 16}" y2="${top + headH - 4}" stroke="${LINE}"/>`;
    items.forEach((it, i) => {
      const y = top + headH + 18 + i * rowH;
      s += `<circle cx="${x + 21}" cy="${y - 4}" r="2.6" fill="${accent}"/>`;
      s += `<text x="${x + 32}" y="${y}" font-family="${DISP}" font-size="12.5" fill="${BODY}">${esc(clamp(it, 34))}</text>`;
    });
  });
  return s + "</svg>";
}

const RENDERERS = { flow, bars, split };

// spec: { type, title, caption, items|left|right }
export function renderDiagram(spec) {
  if (!spec || typeof spec !== "object") return null;
  const fn = RENDERERS[spec.type];
  if (!fn) return null;
  if ((spec.type === "flow" || spec.type === "bars")
      && (!Array.isArray(spec.items) || spec.items.length < 2)) return null;
  let svg;
  try { svg = fn(spec); } catch { return null; }
  if (!svg) return null;
  const cap = spec.caption
    ? `\n    <figcaption>${esc(clamp(spec.caption, 180))}</figcaption>` : "";
  return `  <figure class="figure">\n    ${svg}${cap}\n  </figure>`;
}

export const DIAGRAM_SCHEMA = `Return ONLY minified JSON, no prose, no code fences. One of these shapes:
{"type":"flow","title":"<=70 chars","caption":"one sentence","items":[{"label":"<=18 chars","note":"<=22 chars"}, ...3-5 items]}
{"type":"bars","title":"<=70 chars","caption":"one sentence","items":[{"label":"<=30 chars","value":<number>,"display":"e.g. 4.2x or $18k","highlight":<true for the key bar>}, ...2-5 items]}
{"type":"split","title":"<=70 chars","caption":"one sentence","left":{"heading":"<=26 chars","items":["<=34 chars", ...2-4]},"right":{"heading":"<=26 chars","items":["<=34 chars", ...2-4]}}
Pick the type that genuinely fits the article. "flow" for a pipeline or chain of steps, "bars" for a comparison of magnitudes, "split" for what-breaks vs what-fixes-it. Keep labels terse — they render inside a fixed-width box. Never invent statistics: for "bars", only use numbers that are illustrative and clearly generic, and say so in the caption.`;
