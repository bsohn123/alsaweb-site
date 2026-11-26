/* FAQ « carnet de route » (accueil).
   Sans JavaScript, ou sous 1000 px de large : chaque question se déplie (details), une seule ouverte à la fois.
   À partir de 1000 px : la réponse s'affiche dans la fiche à droite (#faq-fiche), sans que la page bouge.
   Dans les deux cas, chaque question lue colore son morceau de route (classe « lu »). */
(function () {
  var route = document.getElementById('faq-route');
  var fiche = document.getElementById('faq-fiche');
  if (!route || !fiche) return;
  var qs = Array.prototype.slice.call(route.querySelectorAll('.faq-q'));
  if (!qs.length) return;
  var $ = function (id) { return document.getElementById(id); };
  var grand = window.matchMedia('(min-width: 1000px)');
  var cur = 0;

  function compter() {
    $('faq-compte').textContent = route.querySelectorAll('.faq-q.lu').length + ' questions lues sur ' + qs.length;
  }

  function montrer(i) {
    cur = i;
    qs.forEach(function (d, k) {
      d.classList.toggle('actuelle', k === i);
      d.querySelector('summary').setAttribute('aria-current', k === i ? 'true' : 'false');
    });
    var d = qs[i];
    d.classList.add('lu');
    $('faq-fiche-km').textContent = d.querySelector('.faq-km').textContent + ' · ' + d.dataset.troncon;
    $('faq-fiche-objection').textContent = d.querySelector('.faq-objection').textContent;
    $('faq-fiche-question').textContent = d.querySelector('.faq-question').textContent;
    var r = $('faq-fiche-reponse');
    r.textContent = '';
    Array.prototype.forEach.call(d.querySelectorAll('.faq-r p:not(.faq-objection)'), function (p) {
      r.appendChild(p.cloneNode(true));
    });
    fiche.classList.remove('change'); void fiche.offsetWidth; fiche.classList.add('change');
    compter();
  }

  function mode() {
    var f = grand.matches;
    route.classList.toggle('fiche', f);
    fiche.hidden = !f;
    qs.forEach(function (d) {
      var s = d.querySelector('summary');
      if (f) { d.open = false; s.setAttribute('aria-controls', 'faq-fiche'); }
      else { d.classList.remove('actuelle'); s.removeAttribute('aria-controls'); s.removeAttribute('aria-current'); }
    });
    if (f) montrer(cur);
  }

  qs.forEach(function (d, i) {
    d.querySelector('summary').addEventListener('click', function (e) {
      if (route.classList.contains('fiche')) { e.preventDefault(); montrer(i); }
    });
    d.addEventListener('toggle', function () {
      if (!d.open || route.classList.contains('fiche')) return;
      d.classList.add('lu');
      qs.forEach(function (o, k) { if (k !== i && o.open) o.open = false; });
    });
  });
  $('faq-precedente').addEventListener('click', function () { montrer((cur + qs.length - 1) % qs.length); });
  $('faq-suivante').addEventListener('click', function () { montrer((cur + 1) % qs.length); });
  if (grand.addEventListener) grand.addEventListener('change', mode); else grand.addListener(mode);
  mode();
})();
