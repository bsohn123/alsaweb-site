/* Carte en direct : lit /data/sites.json et plante une épingle par site client en ligne.
   Pour ajouter un site : une entrée de plus dans data/sites.json, puis push.
   Tant qu'il n'y a aucun site client, la section et ses liens (attribut data-carte) restent cachés. */
(function () {
  var svg = document.getElementById('carte-svg');
  var groupe = document.getElementById('epingles');
  var bulle = document.getElementById('bulle');
  var boite = document.getElementById('alsace');
  if (!svg || !groupe) return;

  var lon0 = +svg.dataset.lon0, lat1 = +svg.dataset.lat1, k = +svg.dataset.k, S = +svg.dataset.s, pad = +svg.dataset.pad;
  function projeter(lat, lon) { return { x: (lon - lon0) * k * S + pad, y: (lat1 - lat) * S + pad }; }
  var NS = 'http://www.w3.org/2000/svg';
  var TRENTE_JOURS = 30 * 864e5;

  function el(nom, attrs) {
    var e = document.createElementNS(NS, nom);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    return e;
  }

  function dateFr(iso) {
    var d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  var ouverte = null;
  function fermer() { bulle.hidden = true; ouverte = null; }
  function ouvrir(ep, site, pt) {
    if (ouverte === ep) { fermer(); return; }
    ouverte = ep;
    bulle.textContent = '';
    var t = document.createElement('strong'); t.textContent = site.nom; bulle.appendChild(t);
    var l = document.createElement('span');
    l.textContent = [site.activite, site.commune].filter(Boolean).join(', ');
    bulle.appendChild(l);
    if (site.mise_en_ligne) {
      var d = document.createElement('span');
      d.style.display = 'block'; d.style.color = '#4C5A51';
      d.textContent = 'En ligne depuis le ' + dateFr(site.mise_en_ligne);
      bulle.appendChild(d);
    }
    if (site.url) {
      var a = document.createElement('a');
      a.href = site.url; a.rel = 'noopener'; a.target = '_blank';
      a.textContent = 'Visiter le site';
      a.style.display = 'inline-block'; a.style.marginTop = '6px';
      bulle.appendChild(a);
    }
    var vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect(), rb = boite.getBoundingClientRect();
    var x = r.left - rb.left + pt.x / vb.width * r.width;
    var y = r.top - rb.top + pt.y / vb.height * r.height;
    bulle.style.left = Math.max(120, Math.min(rb.width - 120, x)) + 'px';
    bulle.style.top = y + 'px';
    bulle.hidden = false;
  }

  function planter(site, classe) {
    var pt = projeter(site.lat, site.lon);
    var ep = el('g', { 'class': 'epingle ' + classe, transform: 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')', tabindex: '0', role: 'button', 'aria-label': site.nom + (site.commune ? ', ' + site.commune : '') });
    ep.appendChild(el('circle', { 'class': 'onde', r: '9' }));
    ep.appendChild(el('circle', { 'class': 'tete', r: classe.indexOf('atelier') > -1 ? '11' : '9' }));
    ep.addEventListener('click', function (e) { e.stopPropagation(); ouvrir(ep, site, pt); });
    ep.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(ep, site, pt); } if (e.key === 'Escape') fermer(); });
    groupe.appendChild(ep);
  }

  document.addEventListener('click', function (e) { if (!bulle.hidden && !bulle.contains(e.target)) fermer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !bulle.hidden) fermer(); });

  fetch('/data/sites.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var sites = (data.sites || []).filter(function (s) { return s && s.nom && isFinite(s.lat) && isFinite(s.lon); });
      sites.sort(function (a, b) { return (b.mise_en_ligne || '').localeCompare(a.mise_en_ligne || ''); });
      var maintenant = Date.now();
      // Les plus anciens d'abord, pour que les épingles récentes passent devant
      sites.slice().reverse().forEach(function (s) {
        var recent = s.mise_en_ligne && maintenant - new Date(s.mise_en_ligne + 'T12:00:00') < TRENTE_JOURS;
        planter(s, recent ? 'nouvelle' : '');
      });
      if (data.atelier) planter(data.atelier, 'atelier');

      var compte = document.getElementById('compte');
      var liste = document.getElementById('liste-sites');
      if (sites.length) {
        // La carte n'apparaît qu'à partir du premier site client en ligne
        // (cachée par défaut dans index.html, avec ses liens de menu).
        Array.prototype.forEach.call(document.querySelectorAll('[data-carte]'), function (e) { e.hidden = false; });
        compte.textContent = sites.length === 1 ? '1 site en ligne en Alsace, et le prochain se prépare.' : sites.length + ' sites en ligne en Alsace.';
        sites.slice(0, 5).forEach(function (s) {
          var li = document.createElement('li');
          var nom = document.createElement(s.url ? 'a' : 'strong');
          nom.textContent = s.nom;
          if (s.url) { nom.href = s.url; nom.rel = 'noopener'; nom.target = '_blank'; }
          var lieu = document.createElement('span');
          lieu.textContent = s.commune || '';
          li.appendChild(nom); li.appendChild(lieu);
          liste.appendChild(li);
        });
        liste.hidden = false;
      }
    })
    .catch(function () { /* sans données, la carte reste lisible : contours, villes et zone d'intervention */ });
})();
