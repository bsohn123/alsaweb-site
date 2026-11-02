# alsaweb.fr

Site vitrine d'Alsaweb : création de sites internet pour les commerces et artisans d'Alsace.

Site statique en HTML et CSS, sans étape de compilation.

## Contenu

- `index.html` : la page d'accueil
- `exemples/` : trois démos de commerces fictifs (non indexées)
- `404.html` : page affichée pour une adresse inconnue
- `_headers` : en-têtes HTTP pour Cloudflare Pages (sécurité, cache des images)
- `robots.txt`, `sitemap.xml` : référencement

## Déploiement sur Cloudflare Pages

1. Workers & Pages → Create → Pages → Connect to Git → choisir ce dépôt.
2. Framework preset : **None**. Build command : *vide*. Build output directory : **/**
3. Save and Deploy. Chaque push sur `main` redéploie le site.
4. Custom domains → ajouter `alsaweb.fr` puis `www.alsaweb.fr`.

Les formulaires passent par Formspree : rien à configurer côté Cloudflare.
