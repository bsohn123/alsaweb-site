/* Formulaires : maquette automatique (accueil), demande de démonstration (immersif), ancien mini-audit (remplacé par le diagnostic de assets/trouve.js).
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
    function verifier(portee) {
      var premier = null;
      requis.filter(function (bloc) { return !portee || portee.contains(bloc); }).forEach(function (bloc) {
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
    var commune = form.querySelector('[name="commune"]');
    var $ = function (id) { return document.getElementById(id); };
    var apSlug = $('apercu-slug');
    var STYLES = {
      'Restaurant': { photo: 'exemples/auberge/photos/salle-800.webp', accroche: 'Cuisine de saison', cta: 'Réserver une table', liens: ['La carte', 'Le lieu', 'Réserver'] },
      'Commerce': { photo: 'img/vitrine-alsace.jpg', accroche: 'Votre boutique', cta: 'Venir à la boutique', liens: ['Nouveautés', 'La boutique', 'Venir'] },
      'Artisan': { photo: 'img/apercu-artisan.jpg', accroche: 'Fait main', cta: 'Demander un devis', liens: ['Réalisations', "L'atelier", 'Devis'] },
      'Hébergement': { photo: 'exemples/domaine-ebersol/seq/h361.webp', accroche: 'Séjourner', cta: 'Voir les disponibilités', liens: ['Les chambres', 'Les environs', 'Réserver'] },
      'Autre': { photo: 'exemples/domaine-ebersol/seq/h001.webp', accroche: 'Bienvenue', cta: 'Nous contacter', liens: ['Découvrir', 'Qui sommes-nous', 'Contact'] }
    };
    var photoCourante = '';
    function majApercu() {
      if (!apSlug) return;
      var nom = etab && etab.value.trim() || 'Votre commerce';
      var lieu = commune && commune.value.trim();
      var coche = form.querySelector('[name="activite"]:checked');
      var st = STYLES[coche ? coche.value : 'Restaurant'];
      apSlug.textContent = (slug(etab && etab.value) || 'votre-commerce') + '-' + code;
      $('apercu-nom').textContent = nom;
      $('apercu-marque').textContent = nom;
      $('apercu-accroche').textContent = st.accroche + (lieu ? ', à ' + lieu : ', en Alsace');
      $('apercu-cta').textContent = st.cta;
      ['apercu-l1', 'apercu-l2', 'apercu-l3'].forEach(function (id, i) { $(id).textContent = st.liens[i]; });
      var img = $('apercu-photo');
      if (img && st.photo !== photoCourante) {
        photoCourante = st.photo;
        var pre = new Image();
        pre.onload = function () { img.style.opacity = '0'; setTimeout(function () { img.src = st.photo; img.style.opacity = '1'; }, 180); };
        pre.src = st.photo;
      }
    }
    form.addEventListener('input', majApercu);
    form.addEventListener('change', majApercu);
    photoCourante = 'exemples/auberge/photos/salle-800.webp';
    majApercu();

    // Formulaire en deux étapes
    var etapes = form.querySelectorAll('[data-etape]');
    var progression = document.getElementById('progression');
    function allerA(n) {
      form.classList.toggle('etape-2', n === 2);
      if (progression) {
        var li = progression.querySelectorAll('li');
        li[0].classList.toggle('fait', n === 2);
        li[0].toggleAttribute('aria-current', n === 1); if (n === 1) li[0].setAttribute('aria-current', 'step');
        li[1].toggleAttribute('aria-current', n === 2); if (n === 2) li[1].setAttribute('aria-current', 'step');
      }
      var cible = n === 2 ? form.querySelector('[name="nom"]') : form.querySelector('[name="activite"]:checked') || form.querySelector('[name="activite"]');
      var zone = form.closest('.formulaire');
      if (zone && zone.getBoundingClientRect().top < 0) zone.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (cible) cible.focus({ preventScroll: true });
    }
    if (etapes.length === 2) {
      form.classList.add('js-etapes');
      $('continuer').addEventListener('click', function () { if (verifier(etapes[0])) allerA(2); });
      $('retour').addEventListener('click', function () { allerA(1); });
      etapes[0].addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (verifier(etapes[0])) allerA(2); }
      });
    }

    function montrerErreur(msg) {
      var prec = form.querySelector('.form-erreur'); if (prec) prec.remove();
      var p = document.createElement('p'); p.className = 'form-erreur'; p.setAttribute('role', 'alert');
      p.textContent = msg || "L'envoi n'a pas fonctionné. Réessayez, ou écrivez directement à contact@alsaweb.fr.";
      form.appendChild(p);
    }
    function termine(adr, viaSecours) {
      form.hidden = true;
      var prog = document.getElementById('progression'); if (prog) prog.hidden = true;
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
      if (etapes.length === 2 && !verifier(etapes[0])) { allerA(1); verifier(etapes[0]); return; }
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
  var rapportSite = document.getElementById('rapport-site');
  var auditSite = document.getElementById('audit-site');
  // L'en-tête de l'exemple de rapport reprend l'adresse tapée
  if (auditSite && rapportSite) auditSite.addEventListener('input', function () {
    rapportSite.textContent = auditSite.value.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') || 'www.votre-commerce.fr';
  });
  if (audit) audit.addEventListener('submit', function (e) {
    e.preventDefault();
    var prec0 = audit.querySelector('.form-erreur'); if (prec0) prec0.remove();
    var site = audit.querySelector('[name="site"]').value.trim(), mail = audit.querySelector('[name="email"]').value.trim();
    if (!site || !emailOk(mail)) {
      var pe = document.createElement('p'); pe.className = 'form-erreur'; pe.setAttribute('role', 'alert');
      pe.textContent = !site ? "Indiquez l'adresse de votre site." : 'Indiquez un e-mail valide pour recevoir le rapport.';
      audit.appendChild(pe);
      (site ? audit.querySelector('[name="email"]') : auditSite).focus();
      return;
    }
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
  var zones = document.querySelectorAll('.formulaire, .trouve-form');
  if (barre && zones.length && 'IntersectionObserver' in window) {
    var visibles = new Set();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) visibles.add(en.target); else visibles.delete(en.target); });
      barre.classList.toggle('cachee', visibles.size > 0);
    }, { threshold: 0.1 });
    zones.forEach(function (z) { io.observe(z); });
  }
})();
