/* Offre immersive : vol au-dessus du lieu piloté par le défilement, puis la visite de la démo en onglets.
   Le vol utilise le moteur commun assets/vol.js (lissage, fondu, décodage hors du fil principal).
   La séquence se règle sur #vol : data-seq (préfixe), data-total, data-pas, data-debut-num, data-chiffres,
   data-x-debut et data-x (cadrage horizontal sur téléphone si aucune série portrait, de 0 à 1, au début puis à la fin).
   Facultatif : data-seq-portrait (série déjà recadrée pour téléphone) et data-pas-portrait (une image sur combien). */
(function () {
  var entete = document.getElementById('entete');
  if (entete) {
    var f = function () { entete.classList.toggle('defile', window.scrollY > 8); };
    window.addEventListener('scroll', f, { passive: true }); f();
  }

  /* ---------- Le vol (moteur commun : assets/vol.js) ---------- */
  var vol = document.getElementById('vol');
  var canvas = document.getElementById('vol-canvas');
  var calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (vol && canvas && canvas.getContext && !calme && window.VolDefile) {
    var ds = vol.dataset, scene = vol.firstElementChild;
    var chapitres = Array.prototype.slice.call(vol.querySelectorAll('.chapitre'));
    var barre = document.getElementById('vol-progres');
    var TOTAL = +(ds.total || 120), PREMIER = +(ds.debutNum || 0), CHIFFRES = +(ds.chiffres || 3);
    var X0 = +(ds.xDebut || ds.x || 0.5), X1 = +(ds.x || 0.5);
    var portrait = function () { return canvas.clientWidth / (canvas.clientHeight || 1) < 0.9; };
    var serieM = function () { return portrait() && !!ds.seqPortrait; };

    vol.classList.add('anime');
    var haut = 0, course = 1;
    var mesurer = function () { haut = parseFloat(getComputedStyle(scene).top) || 0; course = Math.max(1, vol.offsetHeight - scene.offsetHeight); };
    mesurer();
    window.addEventListener('resize', mesurer);

    window.VolDefile({
      canvas: canvas,
      serie: function () {
        var m = serieM(), pas = m ? +(ds.pasPortrait || 1) : +(ds.pas || 1), prefixe = m ? ds.seqPortrait : ds.seq;
        return {
          cle: m ? 'm' : 'h',
          n: Math.ceil((TOTAL - PREMIER + 1) / pas),
          url: function (i) { return prefixe + String(Math.min(TOTAL, PREMIER + i * pas)).padStart(CHIFFRES, '0') + '.webp'; }
        };
      },
      // La scène reste collée sous l'en-tête : la course est la hauteur du vol moins celle de la scène
      progression: function () { return Math.min(1, Math.max(0, (haut - vol.getBoundingClientRect().top) / course)); },
      // Série paysage sur un écran en portrait : le cadrage glisse pendant le vol (la série portrait est déjà cadrée)
      cadrage: function (t) { return portrait() && !serieM() ? X0 + (X1 - X0) * t : 0.5; },
      rendu: function (t) {
        chapitres.forEach(function (c) {
          var on = t >= +c.dataset.debut && t < +c.dataset.fin;
          c.classList.toggle('visible', on);
          c.setAttribute('aria-hidden', on ? 'false' : 'true');
        });
        if (barre) barre.style.transform = 'scaleX(' + t.toFixed(4) + ')';
      }
    });
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
