/* Formulaires : maquette automatique (accueil), demande de démonstration (immersif), mini-audit.
   La demande part vers /api/maquette (le Worker). Si le Worker ne répond pas,
   elle part vers Formspree : aucune demande n'est perdue. */
(function () {
  function slug(txt) {
    var s = (txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/['’]/g, '').replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (s.length > 40) { s = s.slice(0, 40); s = s.slice(0, s.lastIndexOf('-') > 20 ? s.lastIndexOf('-') : 40); }
    return s;
  }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function brancherDemande(form) {
    var merci = document.getElementById(form.dataset.merci);
    var adresse = document.getElementById('merci-adresse');
    var texte = document.getElementById('merci-texte');
    var btn = form.querySelector('button[type="submit"]');
    var requis = Array.prototype.slice.call(form.querySelectorAll('[data-requis]'));

    function valeur(nom) {
      var coche = form.querySelector('[name="' + nom + '"]:checked');
      if (coche) return coche.value.trim();
      var champ = form.querySelector('[name="' + nom + '"]:not([type=radio])');
      return champ ? champ.value.trim() : '';
    }
    function verifier() {
      var premier = null;
      requis.forEach(function (bloc) {
        var nom = bloc.getAttribute('data-requis'), v = valeur(nom);
        var bon = nom === 'email' ? emailOk(v) : !!v;
        if (nom === 'email') bloc.querySelector('.erreur').textContent = v ? 'Cette adresse e-mail semble incomplète.' : "Indiquez l'e-mail où recevoir la maquette.";
        bloc.classList.toggle('invalide', !bon);
        if (!bon && !premier) premier = bloc.querySelector('input,textarea');
      });
      if (premier) premier.focus();
      return !premier;
    }
    form.addEventListener('input', function (e) { var b = e.target.closest('.invalide'); if (b && e.target.value.trim()) b.classList.remove('invalide'); });
    form.addEventListener('change', function (e) { var b = e.target.closest('.invalide'); if (b) b.classList.remove('invalide'); });

    // Aperçu de l'adresse privée, mis à jour pendant la saisie
    // Le suffixe rend l'adresse impossible à deviner ; le Worker le reprend s'il est libre.
    var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789', code = '';
    var alea = window.crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(4)) : [0, 0, 0, 0].map(function () { return Math.random() * 256 | 0; });
    for (var i = 0; i < 4; i++) code += alphabet[alea[i] % alphabet.length];
    var etab = form.querySelector('[name="etablissement"]');
    var apSlug = document.getElementById('apercu-slug'), apNom = document.getElementById('apercu-nom');
    if (apSlug) apSlug.textContent = 'votre-commerce-' + code;
    if (etab && apSlug) etab.addEventListener('input', function () {
      apSlug.textContent = (slug(etab.value) || 'votre-commerce') + '-' + code;
      if (apNom) apNom.textContent = etab.value.trim() || 'Votre commerce';
    });

    function montrerErreur(msg) {
      var prec = form.querySelector('.form-erreur'); if (prec) prec.remove();
      var p = document.createElement('p'); p.className = 'form-erreur'; p.setAttribute('role', 'alert');
      p.textContent = msg || "L'envoi n'a pas fonctionné. Réessayez, ou écrivez directement à contact@alsaweb.fr.";
      form.appendChild(p);
    }
    function termine(adr, viaSecours) {
      form.hidden = true;
      if (viaSecours && texte) texte.textContent = form.dataset.merciSecours || 'Votre demande est bien reçue. Je vous recontacte sous 24 h, et votre maquette arrive au plus tard sous 5 jours.';
      if (adresse) { adresse.textContent = viaSecours ? '' : (adr || ''); adresse.hidden = viaSecours || !adr; }
      merci.hidden = false;
      merci.focus({ preventScroll: true });
      merci.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function secours(donnees) {
      var fd = new FormData();
      Object.keys(donnees).forEach(function (k) { fd.append(k, donnees[k]); });
      fd.append('_subject', 'Demande de ' + (donnees.offre === 'immersif' ? 'démonstration immersive' : 'maquette') + ' : ' + (donnees.etablissement || ''));
      return fetch(form.dataset.secours, { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); termine('', true); });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var prec = form.querySelector('.form-erreur'); if (prec) prec.remove();
      if (!verifier()) return;
      var donnees = {};
      new FormData(form).forEach(function (v, k) { donnees[k] = typeof v === 'string' ? v.trim() : v; });
      donnees.offre = form.dataset.offre || 'maquette';
      donnees.code = code;
      if (donnees.site_web) { termine('', true); return; } // robot : on ne dit rien
      var libelle = btn.textContent;
      btn.disabled = true; btn.textContent = 'Envoi en cours…';
      fetch(form.getAttribute('action'), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(donnees) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) { return { r: r, j: j }; });
        })
        .then(function (x) {
          if (x.r.ok && x.j.ok) { termine(x.j.adresse, false); return; }
          if (x.r.status === 400 || x.r.status === 429) { btn.disabled = false; btn.textContent = libelle; montrerErreur(x.j.erreur); return; }
          return secours(donnees);
        })
        .catch(function () { return secours(donnees); })
        .catch(function () { btn.disabled = false; btn.textContent = libelle; montrerErreur(); });
    });
  }

  document.querySelectorAll('form[data-merci]').forEach(brancherDemande);

  // Mini-audit : Formspree, comme avant
  var audit = document.getElementById('audit-form');
  if (audit) audit.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = audit.querySelector('button[type="submit"]'), libelle = btn.textContent;
    var prec = audit.querySelector('.form-erreur'); if (prec) prec.remove();
    btn.disabled = true; btn.textContent = 'Envoi en cours…';
    fetch(audit.action, { method: 'POST', body: new FormData(audit), headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        audit.hidden = true;
        var m = document.getElementById('audit-merci'); m.hidden = false; m.focus({ preventScroll: true });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = libelle;
        var p = document.createElement('p'); p.className = 'form-erreur'; p.setAttribute('role', 'alert');
        p.textContent = "L'envoi n'a pas fonctionné. Réessayez, ou écrivez directement à contact@alsaweb.fr.";
        audit.appendChild(p);
      });
  });

  // La barre d'appel mobile se retire quand un formulaire est à l'écran
  var barre = document.getElementById('barre-mobile');
  var zones = document.querySelectorAll('.formulaire');
  if (barre && zones.length && 'IntersectionObserver' in window) {
    var visibles = new Set();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) visibles.add(en.target); else visibles.delete(en.target); });
      barre.classList.toggle('cachee', visibles.size > 0);
    }, { threshold: 0.1 });
    zones.forEach(function (z) { io.observe(z); });
  }
})();
