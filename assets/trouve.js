/* Section « Deux façons de vous trouver » (#trouve).
   - Les deux téléphones s'animent quand la section arrive à l'écran.
   - Les pastilles changent d'exemple (pizzeria, menuisier, winstub) et relancent l'animation.
   - Sur téléphone, deux onglets montrent un écran à la fois.
   - Le diagnostic gratuit « Et vous, on vous trouve ? » (Google, IA, et site facultatif) part vers Formspree.
   Sans JavaScript, l'exemple de la pizzeria reste affiché, sans animation. */
(function () {
  var section = document.getElementById('trouve');
  if (!section) return;

  var EXEMPLES = [
    { q: 'pizzeria rosheim', question: 'Quelle pizzeria tu me conseilles à Rosheim ?', nom: 'La Bella Rosa', note: '4,8 (212) · Four à bois', heures: 'Ouvert · Ferme à 22:00',
      o1: 'Pizza du Marché', o1m: '4,1 (58) · Pizzeria', o2: 'Chez Nonna', o2m: '3,9 (31) · Restaurant italien',
      a1: 'Pour une bonne pizza à Rosheim, je vous conseille ', a2: " : pâte maison, four à bois, 4,8/5 sur 212 avis. Ouvert ce soir jusqu'à 22 h, réservation en ligne possible.",
      site: 'labellarosa.fr', src: 'TripAdvisor' },
    { q: 'menuisier molsheim', question: 'Tu connais un menuisier sérieux vers Molsheim ?', nom: 'Atelier Kieffer', note: '4,9 (87) · Menuisier', heures: 'Ouvert · Devis sous 48 h',
      o1: 'Bois & Volets', o1m: '4,2 (19) · Menuiserie', o2: 'Menuiserie du Canal', o2m: '4,0 (12) · Menuiserie',
      a1: "Je vous recommande l'", a2: " : fenêtres et escaliers sur mesure, devis sous 48 h, 4,9/5 sur 87 avis. Ils interviennent jusqu'à Obernai.",
      site: 'atelier-kieffer.fr', src: 'Pages Jaunes' },
    { q: 'winstub obernai', question: 'Où manger une vraie choucroute à Obernai ce soir ?', nom: 'Winstub Zum Storich', note: '4,7 (340) · Cuisine alsacienne', heures: 'Ouvert · Ferme à 23:00',
      o1: 'Le Caveau', o1m: '4,3 (122) · Restaurant', o2: "Au Raisin d'Or", o2m: '4,0 (76) · Winstub',
      a1: 'Allez à la ', a2: " : choucroute maison, boiseries d'époque, 4,7/5 sur 340 avis. Il reste des tables ce soir, la réservation se fait sur leur site.",
      site: 'zumstorich.fr', src: 'TripAdvisor' }
  ];

  var cols = section.querySelectorAll('.trouve-col');
  var champs = section.querySelectorAll('[data-t]');
  var vu = false;

  function jouer() {
    if (!vu) return;
    cols.forEach(function (c) {
      c.classList.remove('joue');
      void c.offsetWidth; // relance les animations CSS
      c.classList.add('joue');
    });
  }

  // Exemples
  var choix = document.getElementById('trouve-choix');
  var pastilles = section.querySelectorAll('[data-exemple]');
  choix.classList.add('actif');
  pastilles.forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-pressed') === 'true') return;
      var ex = EXEMPLES[+b.dataset.exemple];
      pastilles.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      champs.forEach(function (el) { el.textContent = ex[el.dataset.t]; });
      jouer();
    });
  });

  // Onglets (affichés sur téléphone seulement, par la feuille de style)
  section.classList.add('js-onglets');
  var onglets = section.querySelectorAll('[data-onglet]');
  function montrer(nom) {
    onglets.forEach(function (o) { o.setAttribute('aria-pressed', String(o.dataset.onglet === nom)); });
    cols.forEach(function (c) { c.classList.toggle('cache', c.dataset.col !== nom); });
  }
  onglets.forEach(function (o) {
    o.addEventListener('click', function () { montrer(o.dataset.onglet); jouer(); });
  });
  montrer('google');

  // Première animation quand les téléphones arrivent à l'écran
  var scene = section.querySelector('.trouve-scene');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { vu = true; jouer(); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(scene);
  }

  // Diagnostic gratuit : Formspree (le champ « site » est facultatif)
  var form = document.getElementById('trouve-form');
  if (!form) return;
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }
  function erreur(msg, champ) {
    var p = document.createElement('p'); p.className = 'form-erreur'; p.setAttribute('role', 'alert');
    p.textContent = msg; form.appendChild(p);
    if (champ) champ.focus();
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var prec = form.querySelector('.form-erreur'); if (prec) prec.remove();
    var commerce = form.querySelector('[name="commerce"]'), ville = form.querySelector('[name="ville"]'), mail = form.querySelector('[name="email"]');
    if (!commerce.value.trim()) return erreur('Indiquez le nom de votre commerce.', commerce);
    if (!ville.value.trim()) return erreur('Indiquez la ville de votre commerce.', ville);
    if (!emailOk(mail.value.trim())) return erreur('Indiquez un e-mail valide pour recevoir le résultat.', mail);
    var btn = form.querySelector('button[type="submit"]'), libelle = btn.textContent;
    btn.disabled = true; btn.textContent = 'Envoi en cours…';
    fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        form.hidden = true;
        var m = document.getElementById('trouve-merci'); m.hidden = false; m.focus({ preventScroll: true });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = libelle;
        erreur("L'envoi n'a pas fonctionné. Réessayez, ou écrivez directement à contact@alsaweb.fr.");
      });
  });
})();
