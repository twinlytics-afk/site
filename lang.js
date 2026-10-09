// Header language dropdown: click to open, Escape / outside click to close.
(function () {
  var d = document.getElementById('langdd');
  if (!d) return;
  var btn = d.querySelector('.langdd-btn');
  function shut() { d.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = d.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', function (e) { if (d.classList.contains('open') && !d.contains(e.target)) shut(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') shut(); });
})();
