/* Offre immersive : vol au-dessus du lieu piloté par le défilement, puis la visite de la démo en onglets.
   Par défaut, le vol réutilise les images du Domaine Ebersol (h001…h361 en paysage, m001…m361 en portrait).
   Une autre séquence se règle sur #vol : data-seq (préfixe), data-total, data-pas, data-debut-num,
   data-chiffres, data-x-debut et data-x (cadrage horizontal sur téléphone, de 0 à 1, au début puis à la fin du vol). Une seule série paysage suffit alors.
   Facultatif : data-seq-portrait (préfixe d'une série déjà recadrée pour téléphone, cadrage inclus) et data-pas-portrait
   (une image sur combien dans cette série). Le téléphone charge alors des images plus légères. */
(function () {
  var entete = document.getElementById('entete');
  if (entete) {
    var f = function () { entete.classList.toggle('defile', window.scrollY > 8); };
    window.addEventListener('scroll', f, { passive: true }); f();
  }

  /* ---------- Le vol ---------- */
  var vol = document.getElementById('vol');
  var canvas = document.getElementById('vol-canvas');
  var calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (vol && canvas && canvas.getContext && !calme) {
    var ctx = canvas.getContext('2d');
    var chapitres = Array.prototype.slice.call(vol.querySelectorAll('.chapitre'));
    var barre = document.getElementById('vol-progres');
    var ds = vol.dataset, perso = !!ds.seq;
    var TOTAL = +(ds.total || 361), PAS = +(ds.pas || 2), PREMIER = +(ds.debutNum || 1), CHIFFRES = +(ds.chiffres || 3);
    var PAS_H = PAS, PAS_M = +(ds.pasPortrait || PAS), SERIE_M = perso && !!ds.seqPortrait;
    var N = Math.ceil((TOTAL - PREMIER + 1) / PAS), PORTRAIT = false;
    var X0 = +(ds.xDebut || ds.x || 0.5), X1 = +(ds.x || 0.5);
    var sens = null, images = [], demandees = [], W = 0, H = 0, progres = 0, prevu = false, generation = 0;

    var src = function (i) {
      var num = Math.min(TOTAL, PREMIER + i * PAS);
      if (perso) return (PORTRAIT && SERIE_M ? ds.seqPortrait : ds.seq) + String(num).padStart(CHIFFRES, '0') + '.webp';
      return 'exemples/domaine-ebersol/seq/' + sens + String(num).padStart(3, '0') + '.webp';
    };

    function charger(i, g) {
      if (demandees[i]) return;
      demandees[i] = true;
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { if (g === generation) { images[i] = im; demander(); } };
      im.src = src(i);
    }
    // D'abord une image sur huit pour avoir tout le vol vite, puis le reste autour de la position courante.
    function plan(g) {
      for (var i = 0; i < N; i += 8) charger(i, g);
      var c = 0;
      (function suite() {
        if (g !== generation) return;
        var centre = Math.round(progres * (N - 1)), lot = 0;
        for (var d = 0; d < N && lot < 6; d++) {
          [centre + d, centre - d].forEach(function (j) { if (j >= 0 && j < N && !demandees[j]) { charger(j, g); lot++; } });
        }
        if (lot && ++c < 400) setTimeout(suite, 120);
      })();
    }

    function proche(i) {
      for (var d = 0; d < N; d++) {
        if (images[i - d]) return images[i - d];
        if (images[i + d]) return images[i + d];
      }
      return null;
    }

    function dimensionner() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var s = W / H < 0.9 ? 'm' : 'h';
      PORTRAIT = perso && s === 'm';
      if (perso && !SERIE_M && sens) s = sens;
      if (s !== sens) {
        sens = s;
        if (SERIE_M) { PAS = PORTRAIT ? PAS_M : PAS_H; N = Math.ceil((TOTAL - PREMIER + 1) / PAS); }
        generation++; images = []; demandees = []; plan(generation);
      }
    }

    function dessiner() {
      prevu = false;
      // La scène reste collée sous l'en-tête : la course est la hauteur du vol moins celle de la scène
      var r = vol.getBoundingClientRect(), scene = vol.firstElementChild;
      var haut = parseFloat(getComputedStyle(scene).top) || 0;
      var course = vol.offsetHeight - scene.offsetHeight;
      progres = Math.min(1, Math.max(0, (haut - r.top) / (course || 1)));
      var im = proche(Math.round(progres * (N - 1)));
      if (im) {
        var e = Math.max(W / im.naturalWidth, H / im.naturalHeight);
        var dw = im.naturalWidth * e, dh = im.naturalHeight * e;
        var cadrage = PORTRAIT && !SERIE_M ? X0 + (X1 - X0) * progres : 0.5;
        ctx.drawImage(im, (W - dw) * cadrage, (H - dh) / 2, dw, dh);
      }
      chapitres.forEach(function (c) {
        var on = progres >= +c.dataset.debut && progres < +c.dataset.fin;
        c.classList.toggle('visible', on);
        c.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      if (barre) barre.style.width = (progres * 100).toFixed(2) + '%';
    }
    function demander() { if (!prevu) { prevu = true; requestAnimationFrame(dessiner); } }

    vol.classList.add('anime');
    dimensionner();
    window.addEventListener('scroll', demander, { passive: true });
    window.addEventListener('resize', function () { dimensionner(); demander(); });
    demander();
  }

  /* ---------- La visite de la démo (onglets) ---------- */
  var onglets = Array.prototype.slice.call(document.querySelectorAll('.heures [role="tab"]'));
  var panneau = document.getElementById('p-moment');
  var img = document.getElementById('moment-img');
  var titre = document.getElementById('moment-titre');
  var texte = document.getElementById('moment-texte');
  // Précharge les quatre images pour un changement instantané
  onglets.forEach(function (o) { var p = new Image(); p.src = o.dataset.img; });

  function choisir(o, focus) {
    onglets.forEach(function (x) {
      var on = x === o;
      x.setAttribute('aria-selected', on ? 'true' : 'false');
      x.tabIndex = on ? 0 : -1;
    });
    img.src = o.dataset.img; img.alt = o.dataset.alt;
    titre.textContent = o.dataset.titre; texte.textContent = o.dataset.texte;
    panneau.setAttribute('aria-labelledby', o.id);
    if (focus) o.focus();
  }
  onglets.forEach(function (o, i) {
    o.addEventListener('click', function () { choisir(o); });
    o.addEventListener('keydown', function (e) {
      var j = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? onglets.length - 1 : null;
      if (j === null) return;
      e.preventDefault();
      choisir(onglets[(j + onglets.length) % onglets.length], true);
    });
  });
})();
