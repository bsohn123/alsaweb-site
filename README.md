# alsaweb.fr

Site vitrine d'Alsaweb : création de sites internet pour les commerces et artisans d'Alsace.

Site statique en HTML et CSS, sans étape de compilation.

## Contenu

- `index.html` : la page d'accueil
- `exemples/` : trois démos de commerces fictifs (non indexées)
- `404.html` : page affichée pour une adresse inconnue
- `_headers` : en-têtes HTTP (sécurité, cache des images)
- `wrangler.jsonc`, `.assetsignore` : configuration Cloudflare
- `robots.txt`, `sitemap.xml` : référencement

## Déploiement sur Cloudflare

Le fichier `wrangler.jsonc` sert le dépôt tel quel (sans compilation) ; `.assetsignore` exclut les fichiers techniques.

1. Create app → Import a repository → choisir ce dépôt.
2. Build command : *vide*. Deploy command : `npx wrangler deploy` (valeur par défaut).
3. Deploy. Chaque push sur `main` redéploie le site.
4. Settings → Domains & Routes → ajouter `alsaweb.fr` puis `www.alsaweb.fr`.

Les formulaires passent par Formspree : rien à configurer côté Cloudflare.
