/* La Route : sur grand écran, la route se trace au fil du défilement,
   le point avance et la carte de l'étape atteinte s'affiche.
   Sur téléphone, avec le mouvement réduit ou sans JavaScript, tout reste affiché en liste. */
(function () {
  var entete = document.getElementById('entete');
  if (entete) {
    var surveiller = function () { entete.classList.toggle('defile', window.scrollY > 8); };
    window.addEventListener('scroll', surveiller, { passive: true });
    surveiller();
  }

  var section = document.getElementById('route');
  var trace = document.getElementById('trace');
  if (!section || !trace || !trace.getTotalLength) return;

  var media = window.matchMedia('(min-width: 960px) and (prefers-reduced-motion: no-preference)');
  var vehicule = document.getElementById('vehicule');
  var indice = document.getElementById('indice');
  var arrets = Array.prototype.slice.call(section.querySelectorAll('.arret'));
  var etapes = Array.prototype.slice.call(section.querySelectorAll('.etape'));
  var L = trace.getTotalLength();

  // Position de chaque arrêt le long de la route (en fraction de la longueur totale)
  var echantillons = [];
  for (var i = 0; i <= 400; i++) {
    var p = trace.getPointAtLength(L * i / 400);
    echantillons.push({ t: i / 400, x: p.x, y: p.y });
  }
  var positions = arrets.map(function (a) {
    var x = +a.getAttribute('data-x'), y = +a.getAttribute('data-y'), meilleur = 0, d = Infinity;
    echantillons.forEach(function (e) {
      var dd = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (dd < d) { d = dd; meilleur = e.t; }
    });
    return meilleur;
  });

  var actif = -1, prevu = false;

  function afficher(n) {
    if (n === actif) return;
    actif = n;
    etapes.forEach(function (e, j) {
      var on = j === n;
      e.classList.toggle('active', on);
      e.setAttribute('aria-hidden', on ? 'false' : 'true');
      e.querySelectorAll('a').forEach(function (a) { a.tabIndex = on ? 0 : -1; });
    });
  }

  function dessiner() {
    prevu = false;
    var r = section.getBoundingClientRect();
    var course = section.offsetHeight - window.innerHeight;
    var p = Math.min(1, Math.max(0, -r.top / (course || 1)));
    trace.style.strokeDashoffset = String(L * (1 - p));
    var pt = trace.getPointAtLength(L * p);
    vehicule.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
    var n = 0;
    positions.forEach(function (t, j) {
      var atteint = p >= t - 0.01;
      arrets[j].classList.toggle('atteint', atteint);
      if (atteint) n = j;
    });
    afficher(n);
    if (indice) indice.style.opacity = p > 0.04 ? '0' : '1';
  }

  function demander() { if (!prevu) { prevu = true; requestAnimationFrame(dessiner); } }

  // Un clic sur un arrêt amène directement à son étape
  arrets.forEach(function (a, j) {
    a.style.cursor = 'pointer';
    a.addEventListener('click', function () {
      if (!section.classList.contains('anime')) { etapes[j].scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      var course = section.offsetHeight - window.innerHeight;
      window.scrollTo({ top: section.offsetTop + course * positions[j] + 2, behavior: 'smooth' });
    });
  });

  function appliquer() {
    if (media.matches) {
      section.classList.add('anime');
      trace.style.strokeDasharray = L + ' ' + L;
      window.addEventListener('scroll', demander, { passive: true });
      window.addEventListener('resize', demander);
      dessiner();
    } else {
      section.classList.remove('anime');
      trace.style.strokeDasharray = '';
      trace.style.strokeDashoffset = '';
      window.removeEventListener('scroll', demander);
      window.removeEventListener('resize', demander);
      actif = -1;
      etapes.forEach(function (e) { e.classList.remove('active'); e.removeAttribute('aria-hidden'); e.querySelectorAll('a').forEach(function (a) { a.removeAttribute('tabindex'); }); });
      arrets.forEach(function (a) { a.classList.add('atteint'); });
    }
  }
  if (media.addEventListener) media.addEventListener('change', appliquer); else media.addListener(appliquer);
  appliquer();
})();
