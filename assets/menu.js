/* Menu sur téléphone et tablette (sous 860 px) : le bouton « Menu » ouvre la navigation sous l'en-tête. */
(function () {
  var bouton = document.getElementById('menu-bouton');
  var entete = document.getElementById('entete');
  var nav = document.getElementById('nav-principale');
  if (!bouton || !entete || !nav) return;

  function basculer(ouvrir) {
    entete.classList.toggle('menu-ouvert', ouvrir);
    bouton.setAttribute('aria-expanded', ouvrir ? 'true' : 'false');
  }
  bouton.addEventListener('click', function () { basculer(bouton.getAttribute('aria-expanded') !== 'true'); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) basculer(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && entete.classList.contains('menu-ouvert')) { basculer(false); bouton.focus(); }
  });
  document.addEventListener('click', function (e) { if (!entete.contains(e.target)) basculer(false); });
  window.matchMedia('(min-width: 861px)').addEventListener('change', function (m) { if (m.matches) basculer(false); });
})();
