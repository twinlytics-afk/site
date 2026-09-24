// Contact dock: a floating "Contact" button (desktop) or a Telegram | Book a call
// bar (mobile) on every page, so a reader deep in a blog post is one click from
// us instead of a trip to the bottom of the home page. Every "#contact" link
// opens it. Self-contained (injects its own CSS); included by
// scripts/sync-blog.mjs on every page. Tracked in GTM as event "contact_dock".
(function () {
  var CAL = 'https://cal.com/twinlytics-vcua0p/30min';
  var TG = 'https://t.me/vhalstian';
  var MAIL = 'twinslytics@gmail.com';
  var T = {
    en: { form: '/#contact', fab: 'Contact', title: "Let's find your real numbers", who: 'Vlad & team · reply within a day', call: 'Book a 30-minute call', bar: 'Book a call', more: 'Or send us a message', back: 'Back', close: 'Close' },
    uk: { form: '/ua#contact', fab: 'Контакти', title: 'Знайдемо ваші реальні цифри', who: 'Влад і команда · відповідаємо протягом дня', call: 'Дзвінок на 30 хвилин', bar: 'Дзвінок', more: 'Або напишіть нам', back: 'Назад', close: 'Закрити' }
  };
  var t = T[(document.documentElement.lang || 'en').slice(0, 2)] || T.en;
  var track = function (action) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'contact_dock', contact_action: action });
  };
  var icon = {
    chat: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" stroke-linejoin="round"/></svg>',
    tg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5z"/></svg>',
    cal: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 6.5 8.5 7 8.5-7"/></svg>'
  };

  var css =
    '.cdock{position:fixed;right:24px;bottom:24px;z-index:90;font-family:Inter,system-ui,sans-serif;opacity:0;visibility:hidden;transform:translateY(12px);transition:opacity .3s,transform .3s,visibility .3s}' +
    '.cdock.shown{opacity:1;visibility:visible;transform:none}' +
    '.cdock-fab{display:flex;align-items:center;gap:9px;background:linear-gradient(90deg,#6c4cf0,#a24cf0 55%,#ff7a59);color:#fff;border:0;border-radius:999px;padding:14px 22px;cursor:pointer;font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:15px;box-shadow:0 14px 34px -12px rgba(108,76,240,.6);transition:transform .2s,box-shadow .2s}' +
    '.cdock-fab:hover{transform:translateY(-2px);box-shadow:0 18px 40px -12px rgba(108,76,240,.7)}' +
    '.cdock.open .cdock-fab{display:none}' +
    '.cdock-panel{width:min(360px,calc(100vw - 32px));background:#fff;border:1px solid #e0daef;border-radius:18px;box-shadow:0 24px 60px -20px rgba(20,18,43,.35);padding:24px 22px 20px;position:relative;color:#14122b}' +
    '.cdock-panel[hidden],.cdock-view[hidden]{display:none}' +
    '.cdock.wide .cdock-panel{width:min(460px,calc(100vw - 32px));padding:12px 12px 0}' +
    '.cdock-x{position:absolute;top:10px;right:12px;background:none;border:0;font-size:24px;line-height:1;color:#6f6a8a;cursor:pointer;padding:4px 6px}' +
    '.cdock-x:hover{color:#14122b}' +
    '.cdock-title{font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:20px;letter-spacing:-.02em;line-height:1.2;padding-right:28px}' +
    '.cdock-who{font-size:13px;color:#6f6a8a;margin:6px 0 16px}' +
    '.cdock-btn{display:flex;align-items:center;gap:12px;padding:12px 15px;margin-top:8px;border:1px solid #e0daef;border-radius:10px;font-size:14.5px;color:#14122b;text-decoration:none;transition:border-color .2s,background .2s}' +
    '.cdock-btn:hover{border-color:#6c4cf0;background:#faf9ff}' +
    '.cdock-btn svg{flex:0 0 auto;color:#6c4cf0}' +
    '.cdock-btn.cdock-main{background:linear-gradient(90deg,#6c4cf0,#a24cf0 55%,#ff7a59);border:0;color:#fff;font-weight:600}' +
    '.cdock-btn.cdock-main svg{color:#fff}' +
    '.cdock-more{display:inline-block;margin-top:14px;font-size:13.5px;color:#6c4cf0;text-decoration:none}' +
    '.cdock-more:hover{text-decoration:underline}' +
    '.cdock-calhead{display:flex;align-items:center;justify-content:space-between;padding:0 4px 8px}' +
    '.cdock-calhead .cdock-x{position:static}' +
    '.cdock-back{background:none;border:0;cursor:pointer;font-size:13.5px;color:#5a5675}' +
    '.cdock-calview iframe{display:block;width:100%;height:min(600px,calc(100vh - 200px));border:0}' +
    '.cdock-bar{display:none}' +
    '@media(max-width:760px){' +
      '.cdock{left:0;right:0;bottom:0}' +
      '.cdock-fab{display:none}' +
      '.cdock-bar{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid #ece7f6;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}' +
      '.cdock-bar a{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 10px;border:1px solid #e0daef;border-radius:10px;font-family:"Space Grotesk",system-ui,sans-serif;font-weight:600;font-size:14.5px;color:#14122b;text-decoration:none}' +
      '.cdock-bar a.cdock-main{background:linear-gradient(90deg,#6c4cf0,#a24cf0 55%,#ff7a59);border:0;color:#fff}' +
      '.cdock-panel{position:fixed;left:0;right:0;bottom:0;width:auto;border-radius:18px 18px 0 0;border-width:1px 0 0;padding-bottom:calc(20px + env(safe-area-inset-bottom))}' +
      '.cdock.open .cdock-bar{display:none}' +
      'html.has-cbar body{padding-bottom:72px}' +
    '}' +
    '@media print{.cdock{display:none}}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  var dock = document.createElement('div');
  dock.className = 'cdock';
  dock.innerHTML =
    '<button class="cdock-fab" type="button" aria-expanded="false" aria-controls="cdock-panel">' + icon.chat + '<span>' + t.fab + '</span></button>' +
    '<div class="cdock-panel" id="cdock-panel" role="dialog" aria-label="' + t.title + '" hidden>' +
      '<div class="cdock-view" data-view="main">' +
        '<button class="cdock-x" type="button" aria-label="' + t.close + '">&times;</button>' +
        '<p class="cdock-title">' + t.title + '</p>' +
        '<p class="cdock-who">' + t.who + '</p>' +
        '<a class="cdock-btn cdock-main" href="' + CAL + '" target="_blank" rel="noopener" data-view-go="cal" data-track="call">' + icon.cal + t.call + '</a>' +
        '<a class="cdock-btn" href="' + TG + '" target="_blank" rel="noopener" data-track="telegram">' + icon.tg + 'Telegram</a>' +
        '<a class="cdock-btn" href="mailto:' + MAIL + '" data-track="email">' + icon.mail + MAIL + '</a>' +
        '<a class="cdock-more" href="' + t.form + '" data-dock-skip data-track="form">' + t.more + ' &rarr;</a>' +
      '</div>' +
      '<div class="cdock-view cdock-calview" data-view="cal" hidden>' +
        '<div class="cdock-calhead"><button class="cdock-back" type="button">&larr; ' + t.back + '</button>' +
        '<button class="cdock-x" type="button" aria-label="' + t.close + '">&times;</button></div>' +
      '</div>' +
    '</div>' +
    '<div class="cdock-bar">' +
      '<a href="' + TG + '" target="_blank" rel="noopener" data-track="telegram">' + icon.tg + 'Telegram</a>' +
      '<a class="cdock-main" href="' + CAL + '" target="_blank" rel="noopener" data-track="call">' + icon.cal + t.bar + '</a>' +
    '</div>';
  document.body.appendChild(dock);

  var fab = dock.querySelector('.cdock-fab');
  var panel = dock.querySelector('.cdock-panel');
  var views = [].slice.call(dock.querySelectorAll('.cdock-view'));
  var mobile = window.matchMedia('(max-width: 760px)');
  var section = document.getElementById('contact');
  var sectionVisible = false;

  function onScroll() {
    var on = window.scrollY > 320 && !sectionVisible;
    dock.classList.toggle('shown', on || dock.classList.contains('open'));
    document.documentElement.classList.toggle('has-cbar', on);
  }
  function show(name) {
    views.forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    dock.classList.toggle('wide', name === 'cal');
    if (name === 'cal' && !dock.querySelector('.cdock-calview iframe')) {
      var f = document.createElement('iframe');
      f.src = CAL + '?embed=true&theme=light';
      f.title = t.call;
      dock.querySelector('.cdock-calview').appendChild(f);
    }
  }
  function open() {
    show('main');
    panel.hidden = false;
    dock.classList.add('open', 'shown');
    fab.setAttribute('aria-expanded', 'true');
    track('open');
  }
  function shut() {
    panel.hidden = true;
    dock.classList.remove('open', 'wide');
    fab.setAttribute('aria-expanded', 'false');
    onScroll();
  }

  fab.addEventListener('click', open);
  dock.addEventListener('click', function (e) {
    var el = e.target.closest('a,button');
    if (!el) return;
    if (el.hasAttribute('data-track')) track(el.getAttribute('data-track'));
    if (el.classList.contains('cdock-x')) shut();
    if (el.classList.contains('cdock-back')) show('main');
    // on a phone the calendar opens full-screen in a new tab instead
    if (el.getAttribute('data-view-go') && !mobile.matches) { e.preventDefault(); show(el.getAttribute('data-view-go')); }
    if (el.hasAttribute('data-dock-skip')) shut();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dock.classList.contains('open')) shut(); });
  document.addEventListener('click', function (e) {
    if (dock.classList.contains('open') && !dock.contains(e.target) && !e.target.closest('a[href$="#contact"]')) shut();
  });

  // "Book a call" links open the dock instead of jumping to the foot of the home page.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href$="#contact"]');
    if (!a || dock.contains(a) || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    open();
  });

  // Hidden over the first screen and while the page's own contact form is visible.
  if (section && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      sectionVisible = entries[0].isIntersecting;
      onScroll();
    }, { threshold: 0.15 }).observe(section);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
