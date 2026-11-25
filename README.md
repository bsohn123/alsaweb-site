# alsaweb.fr

Site vitrine d'Alsaweb : création de sites internet pour les commerces et artisans d'Alsace.
Version « La Route des sites » (novembre 2026).

HTML, CSS et JavaScript sans étape de compilation, plus un petit Worker Cloudflare pour la maquette automatique.

## Contenu

- `index.html` : l'accueil. La route qui se trace au défilement (grand écran), le formulaire de maquette automatique, la carte en direct, les tarifs, le mini-audit, la FAQ.
- `immersif.html` (servi sur `/immersif`) : l'offre premium pour les hôtels, gîtes et domaines. Le vol réutilise les images de la démo `exemples/le-gres-rose/seq/` (réglage par les attributs `data-*` de `#vol`, voir `assets/immersif.js`).
- `labo/charge/` : la page de présentation de Charge (projet personnel, pas un client), en HTML autonome. Ouverte en plein écran depuis le bloc « Le labo » de `/immersif` (fenêtre `#labo-fenetre`, chargée seulement au clic), non indexée (en-tête `/labo/*`). `apercu.webp` est l'image du bloc.
- `exemples/le-gres-rose/` : la démo d'hôtel immersif (hôtel fictif, visuels IA). Polices hébergées sur place, non indexée (en-tête `/exemples/*`).
- `assets/` : `site.css` (commun aux deux pages), `route.js`, `carte.js`, `formulaires.js`, `immersif.js`.
- `data/sites.json` : les épingles de la carte en direct.
- `src/worker.js` : le Worker (API de maquette, relecture, maquettes privées). Non publié comme fichier.
- `agent/maquette-de-nuit.md` : le prompt de l'agent qui prépare les maquettes la nuit. Non publié.
- `exemples/`, `instagram/`, `404.html`, `mentions-legales.html`, `cgv.html` : inchangés, sauf la partie « Données personnelles » des mentions légales (nouveaux prestataires).

## Déploiement sur Cloudflare

Inchangé : chaque push sur `main` redéploie (`npx wrangler deploy`).
Tel quel, le site fonctionne dès le premier push : tant que la maquette automatique n'est pas activée,
le formulaire de maquette envoie la demande à Formspree, comme avant. Aucune demande n'est perdue.

## Carte en direct

Quand un site client est mis en ligne, ajoutez une entrée dans `data/sites.json`, puis push :

```json
{ "nom": "Winstub du Cerf", "activite": "Restaurant", "commune": "Obernai",
  "lat": 48.4622, "lon": 7.4819, "url": "https://winstub-du-cerf.fr", "mise_en_ligne": "2027-01-15" }
```

Coordonnées : clic droit sur le lieu dans Google Maps, puis cliquer sur les chiffres pour les copier.
L'épingle clignote pendant 30 jours après `mise_en_ligne`. Uniquement des clients réels.

## Maquette automatique : activation (une fois)

Le parcours : le prospect remplit le formulaire → la demande est enregistrée → l'agent de nuit prépare la maquette →
vous recevez un e-mail avec un aperçu et un bouton « Valider et envoyer » (ou « Refaire » avec vos consignes) →
le prospect reçoit sa maquette par e-mail, à une adresse privée. Rien ne part sans votre validation.

1. **Stockage.** Tableau de bord Cloudflare → Storage & Databases → KV → Create : `alsaweb-maquettes`.
   Copiez son identifiant, puis dans `wrangler.jsonc` décommentez le bloc `kv_namespaces` et collez l'identifiant.
2. **Secrets.** Workers & Pages → `alsaweb-site` → Settings → Variables and Secrets → ajouter, en type *Secret* :
   - `AGENT_TOKEN` : une longue suite aléatoire (par exemple le résultat de `openssl rand -hex 32`) ;
   - `SIGNATURE_SECRET` : une autre suite aléatoire, différente (signe les liens de relecture) ;
   - `RESEND_API_KEY` : voir l'étape 3.
3. **Envoi des e-mails (Resend, offre gratuite).** Créez un compte sur resend.com, ajoutez le domaine `alsaweb.fr`,
   copiez les enregistrements DNS qu'il donne dans le DNS Cloudflare, attendez la vérification, puis créez une clé d'API.
   Les e-mails partent de `maquette@alsaweb.fr` ; les réponses arrivent sur `contact@alsaweb.fr`.
4. **L'agent de nuit.** Créez une tâche planifiée Claude chaque soir (par exemple 23 h 40) avec le contenu de
   `agent/maquette-de-nuit.md`, et la variable d'environnement `ALSAWEB_AGENT_TOKEN` égale à `AGENT_TOKEN`.
5. **Adresses en sous-domaine (facultatif).** Par défaut, les maquettes sont sur `alsaweb.fr/m/<nom>`.
   Pour `<nom>.alsaweb.fr` : DNS Cloudflare → ajouter un enregistrement `AAAA`, nom `*`, contenu `100::`, proxy activé ;
   puis Workers → `alsaweb-site` → Domains & Routes → Add route : `*.alsaweb.fr/*`, zone `alsaweb.fr` ;
   enfin passez `SOUS_DOMAINES` à `"1"` dans `wrangler.jsonc`.

Chaque adresse de maquette se termine par quatre caractères aléatoires (`au-cerf-dor-k7q2`) : impossible à deviner.
Demandes et maquettes sont effacées automatiquement au bout d'un an. Cinq demandes au plus par jour et par adresse IP.

## Offre immersive

Le formulaire de `/immersif` passe par la même API, sans maquette automatique : vous recevez la demande par e-mail
(avec la capacité du lieu) et rappelez sous 24 h.

## Tester en local

```
printf 'AGENT_TOKEN=test\nSIGNATURE_SECRET=test2\n' > .dev.vars
npx wrangler dev
```

Avec un bloc `kv_namespaces` actif, Wrangler simule le stockage en local. Sans `RESEND_API_KEY`, les e-mails sont seulement écrits dans la console.
