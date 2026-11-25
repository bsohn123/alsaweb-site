/* Vol au fil du défilement : moteur commun à /immersif et à la démo Le Grès Rose.

   Ce qu'il apporte par rapport à « une image = une position de défilement » :
   - lissage : l'image rejoint la position du défilement en douceur, au lieu de sauter
     de plusieurs images à chaque cran de molette ;
   - fondu entre deux images voisines : le mouvement paraît continu même avec peu d'images ;
   - images téléchargées une seule fois (données compressées), puis décodées hors du fil
     principal (createImageBitmap), seulement autour de la position courante : pas d'accroc
     au premier affichage d'une image, et une mémoire maîtrisée (iPhone compris) ;
   - zone de dessin plafonnée à la définition réelle des images (inutile de dessiner
     en Retina une image de 1 280 px).

   Utilisation :
     var vol = VolDefile({
       canvas: element,
       serie: function () { return { cle: 'h', n: 121, url: function (i) { ... } }; },
       progression: function () { return 0..1 },   // position du défilement dans le vol
       versImage: function (t) { return t; },        // facultatif : position -> avancée du film
       cadrage: function (t) { return 0.5; },        // facultatif : cadrage horizontal (0 à 1)
       rendu: function (t) { ... },                  // facultatif : appelé à chaque dessin
       charge: function (nb, total) { ... },         // facultatif : avancement du téléchargement
       lissage: 0.16                                 // facultatif : plus haut = suit plus vite
     });
     vol.reveiller() après un défilement, vol.rafraichir() pour forcer un dessin, vol.redimensionner() après un redimensionnement
     (le moteur écoute déjà scroll et resize). */
(function () {
  'use strict';
  window.VolDefile = function (o) {
    var cv = o.canvas, ctx = cv.getContext('2d', { alpha: false });
    var LISSAGE = o.lissage || 0.16;   // part du chemin restant parcourue par image (à 60 i/s)
    var FENETRE = o.fenetre || 10;     // images décodées de part et d'autre de la position
    var REPERE = 8;                    // une image sur 8 reste décodée : il y a toujours quelque chose à montrer
    var PARALLELE = 6;                 // téléchargements simultanés
    var versImage = o.versImage || function (t) { return t; };
    var cadrage = o.cadrage || function () { return 0.5; };
    var bitmap = typeof createImageBitmap === 'function';

    var serie = null, n = 0, gen = 0;
    var donnees, images, decodage, demande, nbCharge, enVol;
    var W = 0, H = 0, iw = 0, ih = 0;
    var cible = 0, cur = -1, actif = false, dernierT = 0, aDessiner = true, centre = -1;

    function liberer(im) {
      if (!im) return;
      if (im.close) im.close(); else if (im._url) URL.revokeObjectURL(im._url);
    }

    function initialiser() {
      if (images) images.forEach(liberer);
      gen++;
      serie = o.serie(); n = serie.n;
      donnees = new Array(n); images = new Array(n);
      decodage = new Uint8Array(n); demande = new Uint8Array(n);
      nbCharge = 0; enVol = 0; centre = -1; iw = ih = 0;
      pomper();
    }

    /* ---------- Téléchargement : les repères d'abord, puis autour de la position ---------- */
    function prochaine() {
      for (var i = 0; i < n; i += REPERE) if (!demande[i]) return i;
      var c = Math.max(0, centre);
      for (var d = 0; d < n; d++) {
        if (c + d < n && !demande[c + d]) return c + d;
        if (c - d >= 0 && !demande[c - d]) return c - d;
      }
      return -1;
    }
    function pomper() {
      while (enVol < PARALLELE) {
        var i = prochaine();
        if (i < 0) return;
        telecharger(i, gen);
      }
    }
    function telecharger(i, g) {
      demande[i] = 1; enVol++;
      fetch(serie.url(i)).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (b) {
        if (g !== gen) return;
        donnees[i] = b; nbCharge++;
        if (o.charge) o.charge(nbCharge, n);
        if (doitEtreDecodee(i)) decoder(i, g);
      }, function () { /* image manquante : on dessinera la plus proche */ })
        .then(function () { if (g === gen) { enVol--; pomper(); } });
    }

    /* ---------- Décodage hors du fil principal, seulement près de la position ---------- */
    function doitEtreDecodee(i) {
      return i % REPERE === 0 || (centre >= 0 && Math.abs(i - centre) <= FENETRE) || centre < 0 && i <= FENETRE;
    }
    function decoder(i, g) {
      if (images[i] || decodage[i] || !donnees[i]) return;
      decodage[i] = 1;
      var p;
      if (bitmap) p = createImageBitmap(donnees[i]);
      else p = new Promise(function (ok, ko) {
        var im = new Image(); im._url = URL.createObjectURL(donnees[i]);
        im.onload = function () { (im.decode ? im.decode() : Promise.resolve()).then(function () { ok(im); }, function () { ok(im); }); };
        im.onerror = ko; im.src = im._url;
      });
      p.then(function (im) {
        decodage[i] = 0;
        if (g !== gen || !doitEtreDecodee(i)) { liberer(im); return; }
        images[i] = im;
        if (!iw) { iw = im.width || im.naturalWidth; ih = im.height || im.naturalHeight; redimensionner(); }
        aDessiner = true; reveiller();
      }, function () { decodage[i] = 0; });
    }

    // Appelée quand l'image courante change : on décode autour, on libère le reste.
    function gerer(c) {
      if (c === centre) return;
      centre = c;
      for (var i = 0; i < n; i++) {
        if (doitEtreDecodee(i)) { if (donnees[i]) decoder(i, gen); }
        else if (images[i]) { liberer(images[i]); images[i] = null; }
      }
      pomper();
    }

    /* ---------- Dessin ---------- */
    function proche(i) {
      for (var d = 0; d < n; d++) {
        if (images[i - d]) return images[i - d];
        if (images[i + d]) return images[i + d];
      }
      return null;
    }
    function poser(im, alpha) {
      var w = im.width || im.naturalWidth, h = im.height || im.naturalHeight;
      var e = Math.max(W / w, H / h), dw = w * e, dh = h * e;
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, (W - dw) * cadrage(cur), (H - dh) / 2, dw, dh);
    }
    function dessiner() {
      var f = Math.min(1, Math.max(0, versImage(cur))) * (n - 1);
      var i = Math.floor(f), k = f - i, a = images[i], b = images[Math.min(n - 1, i + 1)];
      if (a && b && b !== a && k > 0.01) { poser(a, 1); poser(b, k); }
      else { var im = a || proche(Math.round(f)); if (im) poser(im, 1); }
      ctx.globalAlpha = 1;
      gerer(Math.round(f));
    }

    /* ---------- Boucle : ne tourne que pendant un mouvement ---------- */
    function boucle(t) {
      var dt = dernierT ? Math.min(64, t - dernierT) : 16.7;
      dernierT = t;
      cible = o.progression();
      if (cur < 0) cur = cible;
      var d = cible - cur;
      if (Math.abs(d) > 0.0003) { cur += d * (1 - Math.pow(1 - LISSAGE, dt / 16.7)); aDessiner = true; }
      else if (cur !== cible) { cur = cible; aDessiner = true; }
      if (aDessiner) { aDessiner = false; dessiner(); if (o.rendu) o.rendu(cur); }
      if (Math.abs(cible - cur) > 0.0003) requestAnimationFrame(boucle);
      else { actif = false; dernierT = 0; }
    }
    function reveiller() {
      if (!actif) { actif = true; requestAnimationFrame(boucle); }
    }

    function redimensionner() {
      var s = o.serie();
      if (!serie || s.cle !== serie.cle) initialiser();
      W = cv.clientWidth; H = cv.clientHeight;
      if (!W || !H) return;
      // Au-delà d'un pixel d'image par pixel d'écran, une zone de dessin plus fine n'apporte rien
      var r = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      if (iw) r = Math.max(1, Math.min(r, 1 / Math.max(W / iw, H / ih)));
      cv.width = Math.round(W * r); cv.height = Math.round(H * r);
      ctx.setTransform(r, 0, 0, r, 0, 0);
      aDessiner = true; reveiller();
    }

    window.addEventListener('scroll', reveiller, { passive: true });
    window.addEventListener('resize', redimensionner);
    redimensionner();
    function rafraichir() { aDessiner = true; reveiller(); }
    return { reveiller: reveiller, rafraichir: rafraichir, redimensionner: redimensionner, position: function () { return cur; } };
  };
})();
