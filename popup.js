// Timed lead popup: appears once, 20s into the SESSION (not 20s on a single
// page — hopping from the homepage to a blog post 10s in still fires it at
// the 20s mark, not 20s after the second page loads). Offers a free demo +
// 10% off. Suppressed for 30 days after it's shown once (submitted or
// dismissed) so a returning visitor isn't nagged. Posts to the same
// Formspree endpoint as the homepage contact form, tagged so leads from this
// popup are identifiable.
(function () {
  var DELAY_MS = 20000;
  var SNOOZE_DAYS = 5;
  var ENDPOINT = 'https://formspree.io/f/xqeryybv';
  var KEY = 'tw_popup_seen';
  var SESSION_KEY = 'tw_session_start';

  function suppressed() {
    try {
      var t = +localStorage.getItem(KEY);
      return t && (Date.now() - t) < SNOOZE_DAYS * 86400000;
    } catch (e) { return false; }
  }
  function markSeen() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  }
  // sessionStorage clears when the tab/browser session ends, so this is a
  // fresh 20s countdown per visit but shared across every page in it.
  function sessionElapsedMs() {
    try {
      var start = +sessionStorage.getItem(SESSION_KEY);
      if (!start) { start = Date.now(); sessionStorage.setItem(SESSION_KEY, String(start)); }
      return Date.now() - start;
    } catch (e) { return 0; }
  }

  if (suppressed()) return;

  var lang = (document.documentElement.lang || 'en').slice(0, 2);
  var T = {
    en: { eyebrow: 'Limited offer', title: "Get a free demo + 10% off", sub: "Leave your email and we'll reach out within a day with a free walkthrough and 10% off your first project.",
      email: 'Work email', name: 'Name (optional)', cta: 'Claim my 10%', fine: 'No spam — just a reply from us.', ok: "Got it — we'll be in touch shortly.", close: 'Close' },
    uk: { eyebrow: 'Обмежена пропозиція', title: 'Безкоштовне демо + знижка 10%', sub: 'Залиште email — ми звʼяжемось протягом дня з безкоштовним демо і знижкою 10% на перший проєкт.',
      email: 'Робочий email', name: "Ім'я (необов'язково)", cta: 'Отримати 10%', fine: 'Без спаму — лише відповідь від нас.', ok: 'Дякуємо — скоро звʼяжемось.', close: 'Закрити' },
  };
  var t = T[lang] || T.en;

  var css = '.tw-pop-bg{position:fixed;inset:0;background:rgba(20,18,43,.45);z-index:120;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .25s}' +
    '.tw-pop-bg.in{opacity:1}' +
    '.tw-pop{background:#fff;border-radius:18px;max-width:420px;width:100%;padding:32px 28px 26px;position:relative;box-shadow:0 40px 90px -30px rgba(20,18,43,.5);font-family:Inter,system-ui,sans-serif;transform:translateY(14px);transition:transform .25s;text-align:left}' +
    '.tw-pop-bg.in .tw-pop{transform:translateY(0)}' +
    '.tw-pop-x{position:absolute;top:12px;right:14px;background:none;border:0;font-size:22px;line-height:1;color:#6f6a8a;cursor:pointer;padding:6px}' +
    '.tw-pop-x:hover{color:#14122b}' +
    '.tw-pop-eyebrow{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6c4cf0;background:#f2ecff;display:inline-block;padding:5px 11px;border-radius:20px;margin-bottom:14px}' +
    '.tw-pop h3{font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:22px;letter-spacing:-.02em;color:#14122b;margin:0 0 10px;line-height:1.25}' +
    '.tw-pop p{color:#5a5675;font-size:14.5px;line-height:1.5;margin:0 0 18px}' +
    '.tw-pop input{width:100%;font-family:inherit;font-size:14.5px;padding:11px 13px;border:1px solid #e0daef;border-radius:9px;margin-bottom:10px;background:#fff;color:#14122b}' +
    '.tw-pop input:focus{outline:2px solid rgba(108,76,240,.3);outline-offset:1px;border-color:#6c4cf0}' +
    '.tw-pop button[type=submit]{width:100%;font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:15px;color:#fff;background:linear-gradient(90deg,#6c4cf0,#a24cf0 55%,#ff7a59);border:0;border-radius:9px;padding:13px;cursor:pointer;margin-top:4px}' +
    '.tw-pop .fine{font-size:11.5px;color:#9a96ab;margin:10px 0 0;text-align:center}' +
    '.tw-pop-ok{font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:16px;color:#14122b}' +
    '@media(max-width:480px){.tw-pop{padding:26px 20px 20px}}';
  var style = document.createElement('style');
  style.textContent = css;

  function build() {
    var bg = document.createElement('div');
    bg.className = 'tw-pop-bg';
    bg.innerHTML =
      '<div class="tw-pop" role="dialog" aria-modal="true" aria-label="' + t.title + '">' +
        '<button type="button" class="tw-pop-x" aria-label="' + t.close + '">&times;</button>' +
        '<span class="tw-pop-eyebrow">' + t.eyebrow + '</span>' +
        '<h3>' + t.title + '</h3>' +
        '<p>' + t.sub + '</p>' +
        '<form>' +
          '<input type="text" name="name" placeholder="' + t.name + '" autocomplete="name" />' +
          '<input type="email" name="email" placeholder="' + t.email + '" autocomplete="email" required />' +
          '<input type="hidden" name="source" value="popup_40s_discount" />' +
          '<button type="submit">' + t.cta + '</button>' +
        '</form>' +
        '<p class="fine">' + t.fine + '</p>' +
      '</div>';
    document.body.appendChild(style);
    document.body.appendChild(bg);

    var form = bg.querySelector('form');
    var close = function () {
      bg.classList.remove('in');
      setTimeout(function () { bg.remove(); }, 250);
      markSeen();
      document.removeEventListener('keydown', onKey);
    };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    bg.querySelector('.tw-pop-x').addEventListener('click', close);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    document.addEventListener('keydown', onKey);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch(ENDPOINT, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .catch(function () {})
        .then(function () {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'popup_lead', popup_source: 'popup_40s_discount' });
          window.dataLayer.push({ event: 'generate_lead', lead_source: 'popup_discount' });
          form.outerHTML = '<p class="tw-pop-ok">' + t.ok + '</p>';
          setTimeout(close, 2200);
        });
    });

    requestAnimationFrame(function () { bg.classList.add('in'); });
  }

  var remaining = Math.max(0, DELAY_MS - sessionElapsedMs());
  setTimeout(function () { if (!suppressed()) build(); }, remaining);
})();
