/* Tarifs : le visiteur coche ses besoins, la route le mène à la formule qui lui convient. */
(function () {
  var besoins = document.getElementById('besoins');
  var route = document.getElementById('route-offres');
  var offres = Array.prototype.slice.call(document.querySelectorAll('#offres .offre'));
  var bilan = document.getElementById('bilan');
  var inter = document.getElementById('interrupteur-forfait');
  if (!besoins || !route || offres.length !== 3) return;
  besoins.hidden = false;

  var NOMS = ['Essentiel', 'Vitrine Pro', 'Sur-mesure'];
  var PRIX = ['790 € une fois', '1 490 € une fois', 'sur devis'];
  var puces = Array.prototype.slice.call(besoins.querySelectorAll('.besoin'));
  var forfait = false;

  function maj() {
    var choisis = puces.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
    var n = choisis.length ? Math.max.apply(null, choisis.map(function (b) { return +b.dataset.niveau; })) : 1;
    route.style.setProperty('--n', n);
    offres.forEach(function (o, i) {
      o.classList.toggle('choisie', i === n);
      o.querySelector('.offre-tag').textContent = i === n ? (choisis.length ? 'Votre route' : 'Le choix des restaurants') : '';
    });
    bilan.textContent = '';
    bilan.appendChild(document.createTextNode('Votre route : '));
    var b = document.createElement('strong'); b.textContent = NOMS[n]; bilan.appendChild(b);
    bilan.appendChild(document.createTextNode(', ' + PRIX[n] + (forfait ? ', puis dès 35 € par mois.' : '.')));
  }

  puces.forEach(function (p) {
    p.addEventListener('click', function () {
      p.setAttribute('aria-pressed', p.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      maj();
    });
  });
  if (inter) inter.addEventListener('click', function () {
    forfait = !forfait;
    inter.setAttribute('aria-checked', forfait ? 'true' : 'false');
    maj();
  });
  maj();
})();
