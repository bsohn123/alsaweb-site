/* Le labo : la page de Charge (projet personnel) en plein écran, chargée seulement au clic.
   Sert sur l'accueil (bloc #labo). Échap dans la page de Charge la referme (message « labo-fermer »). */
(function () {
  var fenetre = document.getElementById('labo-fenetre');
  if (fenetre && typeof fenetre.showModal === 'function') {
    var cadre = fenetre.querySelector('iframe');
    var fermer = fenetre.querySelector('.labo-fermer');
    var origine = null;
    Array.prototype.forEach.call(document.querySelectorAll('[data-labo-ouvrir]'), function (a) {
      a.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // ouverture en onglet : on laisse faire
        e.preventDefault();
        origine = a.hasAttribute('aria-hidden') ? document.querySelector('.labo-actions [data-labo-ouvrir]') : a;
        cadre.src = cadre.dataset.src; // recharge à chaque ouverture : l'animation d'ouverture rejoue
        fenetre.showModal();
        document.documentElement.classList.add('fenetre-ouverte');
        fermer.focus();
      });
    });
    fermer.addEventListener('click', function () { fenetre.close(); });
    // Échap pressée dans la page de Charge : elle prévient la fenêtre
    window.addEventListener('message', function (e) {
      if (e.origin === location.origin && e.data === 'labo-fermer' && fenetre.open) fenetre.close();
    });
    fenetre.addEventListener('close', function () {
      document.documentElement.classList.remove('fenetre-ouverte');
      if (origine) origine.focus();
    });
  }
})();
