/**
 * Alsaweb — Worker Cloudflare
 *
 * Sert le site statique (ASSETS) et ajoute :
 *  - POST /api/maquette              : reçoit une demande de maquette (ou de démo immersive)
 *  - GET  /api/agent/demandes        : l'agent de nuit récupère les demandes en attente   (jeton AGENT_TOKEN)
 *  - PUT  /api/agent/maquettes/:id   : l'agent dépose la maquette HTML                     (jeton AGENT_TOKEN)
 *  - POST /api/agent/demandes/:id/echec : l'agent signale une demande qu'il ne peut pas traiter
 *  - GET  /admin/:id?s=…             : page de relecture pour Baptiste (lien signé reçu par e-mail)
 *  - POST /admin/:id/valider|refaire : envoie la maquette au prospect, ou la renvoie à l'agent
 *  - <slug>.alsaweb.fr ou /m/<slug>  : la maquette privée du prospect
 *
 * Rien n'est envoyé au prospect sans la validation de Baptiste.
 *
 * Liaisons (wrangler.jsonc) : ASSETS, MAQUETTES (KV)
 * Variables : DOMAINE, SOUS_DOMAINES ("1" quand le DNS joker est prêt), EMAIL_EXPEDITEUR, EMAIL_BAPTISTE
 * Secrets   : AGENT_TOKEN, SIGNATURE_SECRET, RESEND_API_KEY
 */

const UN_AN = 365 * 24 * 3600;
const MAX_PAR_JOUR_ET_IP = 5;
const ACTIVITES = ['Restaurant', 'Commerce', 'Artisan', 'Hébergement', 'Autre', 'Hôtel', 'Domaine', 'Domaine de réception'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const domaine = env.DOMAINE || 'alsaweb.fr';
    const hote = url.hostname.toLowerCase();

    try {
      // 1. Maquette sur sous-domaine : winstub-le-cerf-k7q2.alsaweb.fr
      if (env.SOUS_DOMAINES === '1' && hote.endsWith('.' + domaine) && hote !== 'www.' + domaine) {
        return servirMaquette(hote.slice(0, -(domaine.length + 1)), url, env);
      }
      // 2. Maquette sur chemin : alsaweb.fr/m/winstub-le-cerf-k7q2
      const m = url.pathname.match(/^\/m\/([a-z0-9-]{3,64})\/?$/);
      if (m) return servirMaquette(m[1], url, env);

      if (url.pathname === '/api/maquette') {
        if (request.method !== 'POST') return json({ ok: false, erreur: 'Méthode non autorisée.' }, 405);
        return creerDemande(request, env, ctx);
      }
      if (url.pathname.startsWith('/api/agent/')) return routeAgent(request, url, env, ctx);
      if (url.pathname.startsWith('/admin/')) return routeAdmin(request, url, env, ctx);
    } catch (e) {
      console.error(e);
      if (url.pathname.startsWith('/api/')) return json({ ok: false, erreur: 'Erreur interne.' }, 500);
      return pageSimple('Un problème est survenu', "Réessayez dans un instant, ou écrivez à contact@alsaweb.fr.", 500);
    }

    return env.ASSETS.fetch(request);
  },
};

/* ---------- Demandes ---------- */

async function creerDemande(request, env, ctx) {
  if (!env.MAQUETTES) return json({ ok: false, erreur: 'Service de maquette non configuré.' }, 503); // le formulaire bascule sur Formspree

  let d;
  try { d = await request.json(); } catch { return json({ ok: false, erreur: 'Demande illisible.' }, 400); }
  if (d.site_web) return json({ ok: true, adresse: null }); // pot de miel : on ne dit rien au robot

  const champ = (k, max) => String(d[k] || '').trim().slice(0, max);
  const demande = {
    offre: d.offre === 'immersif' ? 'immersif' : 'maquette',
    activite: champ('activite', 40),
    etablissement: champ('etablissement', 80),
    commune: champ('commune', 60),
    nom: champ('nom', 80),
    email: champ('email', 120).toLowerCase(),
    telephone: champ('telephone', 30),
    site_actuel: champ('site_actuel', 200),
    message: champ('message', 1200),
    capacite: champ('capacite', 40),
  };
  if (!ACTIVITES.includes(demande.activite)) return json({ ok: false, erreur: 'Choisissez votre activité.' }, 400);
  if (!demande.etablissement) return json({ ok: false, erreur: "Indiquez le nom de votre établissement." }, 400);
  if (!demande.commune) return json({ ok: false, erreur: 'Indiquez votre commune.' }, 400);
  if (!demande.nom) return json({ ok: false, erreur: 'Indiquez votre prénom et votre nom.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(demande.email)) return json({ ok: false, erreur: 'Cette adresse e-mail semble incomplète.' }, 400);

  // Limite : 5 demandes par jour et par adresse IP
  const ip = request.headers.get('CF-Connecting-IP') || 'inconnue';
  const cleIp = `ip:${await empreinte(ip)}:${new Date().toISOString().slice(0, 10)}`;
  const nb = parseInt((await env.MAQUETTES.get(cleIp)) || '0', 10);
  if (nb >= MAX_PAR_JOUR_ET_IP) return json({ ok: false, erreur: "Plusieurs demandes ont déjà été envoyées aujourd'hui. Écrivez directement à contact@alsaweb.fr." }, 429);
  ctx.waitUntil(env.MAQUETTES.put(cleIp, String(nb + 1), { expirationTtl: 86400 }));

  const id = crypto.randomUUID();
  const maintenant = new Date().toISOString();
  let slug = null;

  if (demande.offre === 'maquette') {
    const base = slugifier(demande.etablissement) || 'maquette';
    let code = /^[a-z0-9]{4}$/.test(d.code || '') ? d.code : codeAleatoire();
    for (let i = 0; i < 5 && (await env.MAQUETTES.get(`slug:${base}-${code}`)); i++) code = codeAleatoire();
    slug = `${base}-${code}`;
    await env.MAQUETTES.put(`slug:${slug}`, id, { expirationTtl: UN_AN });
  }

  const enreg = { id, slug, statut: demande.offre === 'maquette' ? 'en_attente' : 'contact', creee: maintenant, notes: [], ...demande };
  await env.MAQUETTES.put(`demande:${id}`, JSON.stringify(enreg), { expirationTtl: UN_AN });
  if (demande.offre === 'maquette') await env.MAQUETTES.put(`attente:${id}`, '1', { expirationTtl: UN_AN });

  ctx.waitUntil(notifierNouvelleDemande(enreg, env));
  return json({ ok: true, adresse: slug ? adresseMaquette(slug, env) : null });
}

/* ---------- Agent de nuit ---------- */

async function routeAgent(request, url, env, ctx) {
  if (!env.MAQUETTES) return json({ ok: false, erreur: 'KV non configuré.' }, 503);
  if (!(await jetonValide(request, env))) return json({ ok: false, erreur: 'Jeton invalide.' }, 401);

  if (url.pathname === '/api/agent/demandes' && request.method === 'GET') {
    const liste = await env.MAQUETTES.list({ prefix: 'attente:' });
    const demandes = [];
    for (const k of liste.keys) {
      const d = await lireDemande(k.name.slice(8), env);
      if (d && d.statut === 'en_attente') demandes.push(versAgent(d, env));
    }
    demandes.sort((a, b) => a.creee.localeCompare(b.creee));
    return json({ ok: true, demandes });
  }

  let m = url.pathname.match(/^\/api\/agent\/maquettes\/([0-9a-f-]{36})$/);
  if (m && request.method === 'PUT') {
    const d = await lireDemande(m[1], env);
    if (!d || !d.slug) return json({ ok: false, erreur: 'Demande introuvable.' }, 404);
    const type = request.headers.get('Content-Type') || '';
    let html = type.includes('application/json') ? String((await request.json()).html || '') : await request.text();
    if (html.length < 500 || !/<html[\s>]/i.test(html)) return json({ ok: false, erreur: 'HTML complet attendu (document <html>).' }, 400);
    if (html.length > 3_000_000) return json({ ok: false, erreur: 'Maquette trop lourde (3 Mo maximum, images hébergées ailleurs).' }, 413);
    await env.MAQUETTES.put(`html:${d.id}`, html, { expirationTtl: UN_AN });
    d.statut = 'a_valider';
    d.maquette_le = new Date().toISOString();
    await ecrireDemande(d, env);
    await env.MAQUETTES.delete(`attente:${d.id}`);
    ctx.waitUntil(notifierMaquettePrete(d, env));
    return json({ ok: true, apercu: await lienApercu(d, env) });
  }

  m = url.pathname.match(/^\/api\/agent\/demandes\/([0-9a-f-]{36})\/echec$/);
  if (m && request.method === 'POST') {
    const d = await lireDemande(m[1], env);
    if (!d) return json({ ok: false, erreur: 'Demande introuvable.' }, 404);
    const corps = await request.json().catch(() => ({}));
    d.statut = 'a_traiter_main';
    d.notes.push({ de: 'agent', le: new Date().toISOString(), texte: String(corps.raison || '').slice(0, 1000) });
    await ecrireDemande(d, env);
    await env.MAQUETTES.delete(`attente:${d.id}`);
    ctx.waitUntil(envoyerEmail(env, {
      to: env.EMAIL_BAPTISTE,
      subject: `À traiter à la main : ${d.etablissement}`,
      text: `L'agent n'a pas pu préparer la maquette de ${d.etablissement} (${d.commune}).\nRaison : ${corps.raison || 'non précisée'}\n\nRelecture : ${await lienAdmin(d, env)}`,
    }));
    return json({ ok: true });
  }

  return json({ ok: false, erreur: 'Route inconnue.' }, 404);
}

function versAgent(d, env) {
  // Uniquement ce qui sert à concevoir le site : ni e-mail, ni téléphone du prospect.
  return {
    id: d.id, slug: d.slug, adresse: adresseMaquette(d.slug, env), creee: d.creee,
    activite: d.activite, etablissement: d.etablissement, commune: d.commune,
    site_actuel: d.site_actuel, message: d.message,
    consignes_de_baptiste: d.notes.filter((n) => n.de === 'baptiste').map((n) => n.texte),
  };
}

/* ---------- Relecture par Baptiste ---------- */

async function routeAdmin(request, url, env, ctx) {
  if (!env.MAQUETTES) return pageSimple('Non configuré', 'Le stockage des maquettes (KV) n’est pas encore relié.', 503);
  const m = url.pathname.match(/^\/admin\/([0-9a-f-]{36})(?:\/(valider|refaire))?$/);
  if (!m) return pageSimple('Introuvable', 'Ce lien ne correspond à aucune demande.', 404);
  const d = await lireDemande(m[1], env);
  if (!d) return pageSimple('Introuvable', 'Cette demande n’existe plus.', 404);

  const fd = request.method === 'POST' ? await request.formData().catch(() => null) : null;
  const s = fd ? fd.get('s') : url.searchParams.get('s');
  if (!(await signatureValide(`admin:${d.id}`, s, env))) return pageSimple('Lien expiré ou incorrect', 'Utilisez le lien reçu par e-mail.', 403);

  if (request.method === 'POST' && m[2] === 'valider') {
    if (d.statut !== 'a_valider') return pageSimple('Déjà traitée', `Statut actuel : ${d.statut}.`, 409);
    const ok = await envoyerMaquetteAuProspect(d, env);
    if (!ok) return pageSimple("L'e-mail n'est pas parti", "Vérifiez la clé RESEND_API_KEY et le domaine d'envoi, puis réessayez. La maquette n'a pas été envoyée.", 502);
    d.statut = 'envoyee';
    d.envoyee_le = new Date().toISOString();
    await ecrireDemande(d, env);
    return pageSimple('Maquette envoyée', `${esc(d.nom)} la reçoit à ${esc(d.email)}. Adresse : <a href="${adresseMaquette(d.slug, env)}">${adresseMaquette(d.slug, env)}</a>`, 200, true);
  }
  if (request.method === 'POST' && m[2] === 'refaire') {
    const note = String((fd && fd.get('note')) || '').trim().slice(0, 1500);
    d.statut = 'en_attente';
    if (note) d.notes.push({ de: 'baptiste', le: new Date().toISOString(), texte: note });
    await ecrireDemande(d, env);
    await env.MAQUETTES.put(`attente:${d.id}`, '1', { expirationTtl: UN_AN });
    return pageSimple('Renvoyée à l’agent', 'Elle sera refaite au prochain passage, avec vos consignes.', 200);
  }
  return pageAdmin(d, s, env);
}

async function pageAdmin(d, s, env) {
  const apercu = d.slug ? await lienApercu(d, env) : null;
  const lignes = [
    ['Offre', d.offre === 'immersif' ? 'Démo immersive (hôtel, domaine)' : 'Maquette automatique'],
    ['Statut', d.statut], ['Reçue le', new Date(d.creee).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })],
    ['Activité', d.activite], ['Établissement', d.etablissement], ['Commune', d.commune], ['Capacité', d.capacite],
    ['Contact', `${d.nom}, ${d.email}${d.telephone ? ', ' + d.telephone : ''}`], ['Site actuel', d.site_actuel], ['Message', d.message],
  ].filter(([, v]) => v);
  const notes = d.notes.map((n) => `<li><b>${n.de}</b> : ${esc(n.texte)}</li>`).join('');
  const actions = d.statut === 'a_valider' ? `
    <p><a class="b" href="${apercu}" target="_blank" rel="noopener">Ouvrir la maquette</a></p>
    <form method="post" action="/admin/${d.id}/valider"><input type="hidden" name="s" value="${esc(s)}">
      <button class="b plein">Valider et envoyer à ${esc(d.email)}</button></form>
    <form method="post" action="/admin/${d.id}/refaire"><input type="hidden" name="s" value="${esc(s)}">
      <label for="note">Ou la renvoyer à l'agent, avec vos consignes</label>
      <textarea id="note" name="note" rows="4" placeholder="Ex. photos trop sombres, mettre la carte des vins en avant."></textarea>
      <button class="b">Refaire cette nuit</button></form>` : apercu ? `<p><a class="b" href="${apercu}" target="_blank" rel="noopener">Ouvrir la maquette</a></p>` : '';
  const corps = `<table>${lignes.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
    ${notes ? `<h2>Notes</h2><ul>${notes}</ul>` : ''}${actions}`;
  return pageSimple(esc(d.etablissement), corps, 200, true);
}

/* ---------- Maquette privée ---------- */

async function servirMaquette(slug, url, env) {
  if (!env.MAQUETTES || !/^[a-z0-9-]{3,64}$/.test(slug)) return maquetteAbsente();
  const id = await env.MAQUETTES.get(`slug:${slug}`);
  const d = id && (await lireDemande(id, env));
  if (!d) return maquetteAbsente();
  const apercuOk = await signatureValide(`apercu:${d.id}`, url.searchParams.get('apercu'), env);
  if (d.statut !== 'envoyee' && !apercuOk) return maquetteAbsente(true);
  let html = await env.MAQUETTES.get(`html:${d.id}`);
  if (!html) return maquetteAbsente(true);
  html = html.replace(/<\/body>/i, `${pastille(d)}</body>`);
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}

function pastille(d) {
  // Ajoutée à chaque maquette : la rappeler comme provisoire, et donner un moyen de répondre.
  const wa = `https://wa.me/33750482176?text=${encodeURIComponent(`Bonjour Baptiste, j'ai vu la maquette de ${d.etablissement}.`)}`;
  return `<div style="position:fixed;z-index:2147483647;left:12px;bottom:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:calc(100% - 24px);padding:8px 8px 8px 14px;border-radius:999px;background:#13221A;color:#EFE4D4;font:500 14px/1.3 system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.5)">
<span>Maquette provisoire, préparée par Alsaweb</span>
<a href="${wa}" style="background:#E39A82;color:#13221A;text-decoration:none;padding:8px 14px;border-radius:999px;font-weight:600">Elle me plaît</a>
<a href="tel:+33750482176" style="color:#EFE4D4;padding:8px 10px">07 50 48 21 76</a></div>`;
}

function maquetteAbsente(enPreparation) {
  return pageSimple(
    enPreparation ? 'Votre maquette est en préparation' : 'Maquette introuvable',
    enPreparation ? 'Elle vous sera envoyée par e-mail dès qu’elle est prête. Une question ? 07 50 48 21 76.' : 'Cette adresse ne correspond à aucune maquette. Vérifiez le lien reçu par e-mail, ou écrivez à contact@alsaweb.fr.',
    404,
  );
}

/* ---------- E-mails ---------- */

async function notifierNouvelleDemande(d, env) {
  const lignes = [
    `Offre : ${d.offre === 'immersif' ? 'démo immersive' : 'maquette automatique'}`,
    `Activité : ${d.activite}`, `Établissement : ${d.etablissement}`, `Commune : ${d.commune}`,
    d.capacite ? `Capacité : ${d.capacite}` : null,
    `Contact : ${d.nom}, ${d.email}${d.telephone ? ', ' + d.telephone : ''}`,
    d.site_actuel ? `Site actuel : ${d.site_actuel}` : null, d.message ? `Message : ${d.message}` : null,
    d.slug ? `Adresse prévue : ${adresseMaquette(d.slug, env)}` : null,
    '', d.offre === 'maquette' ? "L'agent la préparera au prochain passage de nuit." : 'Pas de maquette automatique : à rappeler.',
    `Fiche : ${await lienAdmin(d, env)}`,
  ].filter((x) => typeof x === 'string');
  return envoyerEmail(env, {
    to: env.EMAIL_BAPTISTE,
    reply_to: d.email,
    subject: `${d.offre === 'immersif' ? 'Démo immersive' : 'Nouvelle maquette'} : ${d.etablissement} (${d.commune})`,
    text: lignes.join('\n'),
  });
}

async function notifierMaquettePrete(d, env) {
  return envoyerEmail(env, {
    to: env.EMAIL_BAPTISTE,
    subject: `Maquette à relire : ${d.etablissement}`,
    text: `La maquette de ${d.etablissement} (${d.commune}) est prête.\n\nAperçu : ${await lienApercu(d, env)}\nValider ou faire refaire : ${await lienAdmin(d, env)}\n\nRien ne part au prospect sans votre validation.`,
  });
}

async function envoyerMaquetteAuProspect(d, env) {
  const prenom = d.nom.split(/\s+/)[0];
  const lien = adresseMaquette(d.slug, env);
  const text = `Bonjour ${prenom},

Comme promis, voici la première version du site de ${d.etablissement} :
${lien}

Ouvrez-la sur votre téléphone : c'est là que vos clients la verront. Les textes et les photos sont provisoires ; on les remplace ensuite par les vôtres.

Elle vous plaît ? Répondez simplement à cet e-mail, ou appelez-moi au 07 50 48 21 76 : je vous prépare un devis à prix fixe. Elle ne vous plaît pas ? Dites-le-moi aussi, on s'arrête là, sans engagement.

Baptiste Sohn
Alsaweb, Holtzheim
alsaweb.fr`;
  const html = `<div style="font:16px/1.6 Georgia,serif;color:#1C2620;max-width:560px">
<p>Bonjour ${esc(prenom)},</p>
<p>Comme promis, voici la première version du site de <b>${esc(d.etablissement)}</b> :</p>
<p><a href="${lien}" style="display:inline-block;background:#9A3F2E;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-family:system-ui,sans-serif;font-weight:600">Voir ma maquette</a></p>
<p style="font-family:monospace;color:#4C5A51">${lien}</p>
<p>Ouvrez-la sur votre téléphone : c'est là que vos clients la verront. Les textes et les photos sont provisoires ; on les remplace ensuite par les vôtres.</p>
<p>Elle vous plaît ? Répondez simplement à cet e-mail, ou appelez-moi au <a href="tel:+33750482176">07 50 48 21 76</a> : je vous prépare un devis à prix fixe. Elle ne vous plaît pas ? Dites-le-moi aussi, on s'arrête là, sans engagement.</p>
<p>Baptiste Sohn<br>Alsaweb, Holtzheim<br><a href="https://alsaweb.fr">alsaweb.fr</a></p></div>`;
  return envoyerEmail(env, { to: d.email, reply_to: env.EMAIL_BAPTISTE, subject: `Votre maquette ${d.etablissement} est prête`, text, html });
}

async function envoyerEmail(env, { to, subject, text, html, reply_to }) {
  if (!env.RESEND_API_KEY || !to) { console.log('[e-mail non envoyé, RESEND_API_KEY absente]', to, subject); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_EXPEDITEUR || 'Alsaweb <maquette@alsaweb.fr>', to: [to], subject, text, html, reply_to: reply_to || env.EMAIL_BAPTISTE }),
  });
  if (!r.ok) console.error('Resend', r.status, await r.text());
  return r.ok;
}

/* ---------- Outils ---------- */

function adresseMaquette(slug, env) {
  const dom = env.DOMAINE || 'alsaweb.fr';
  return env.SOUS_DOMAINES === '1' ? `https://${slug}.${dom}` : `https://${dom}/m/${slug}`;
}
async function lienApercu(d, env) { return `${adresseMaquette(d.slug, env)}?apercu=${await signer(`apercu:${d.id}`, env)}`; }
async function lienAdmin(d, env) { return `https://${env.DOMAINE || 'alsaweb.fr'}/admin/${d.id}?s=${await signer(`admin:${d.id}`, env)}`; }

async function lireDemande(id, env) { const v = await env.MAQUETTES.get(`demande:${id}`); return v ? JSON.parse(v) : null; }
async function ecrireDemande(d, env) { await env.MAQUETTES.put(`demande:${d.id}`, JSON.stringify(d), { expirationTtl: UN_AN }); }

export function slugifier(txt) {
  let s = String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’]/g, '').replace(/&/g, ' et ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > 40) { s = s.slice(0, 40); s = s.slice(0, s.lastIndexOf('-') > 20 ? s.lastIndexOf('-') : 40); }
  return s;
}
function codeAleatoire() {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789', b = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(b, (x) => a[x % a.length]).join('');
}
async function cleHmac(env) {
  if (!env.SIGNATURE_SECRET) throw new Error('SIGNATURE_SECRET manquant');
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SIGNATURE_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
async function signer(msg, env) {
  const sig = await crypto.subtle.sign('HMAC', await cleHmac(env), new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function signatureValide(msg, s, env) {
  if (!s || !env.SIGNATURE_SECRET) return false;
  return egaux(await signer(msg, env), String(s));
}
async function jetonValide(request, env) {
  const h = request.headers.get('Authorization') || '';
  return !!env.AGENT_TOKEN && h.startsWith('Bearer ') && egaux(h.slice(7), env.AGENT_TOKEN);
}
function egaux(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function empreinte(txt) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function pageSimple(titre, corps, status = 200, brut = false) {
  return new Response(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${titre} | Alsaweb</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#13221A;color:#EFE4D4;font:17px/1.6 system-ui,sans-serif;padding:24px}
main{max-width:620px;width:100%}h1{font:400 40px/1.1 Georgia,serif;margin:0 0 16px}h2{font:400 24px Georgia,serif;margin:28px 0 8px}
a{color:#E39A82}table{border-collapse:collapse;width:100%;margin:12px 0 24px}th,td{text-align:left;vertical-align:top;padding:8px 12px 8px 0;border-bottom:1px solid #2C4236}th{color:#A3B5A8;font-weight:500;width:130px}
.b{display:inline-block;margin:6px 0;padding:12px 20px;border-radius:999px;border:1.5px solid #EFE4D4;background:none;color:#EFE4D4;font:600 16px system-ui;text-decoration:none;cursor:pointer}
.plein{background:#E39A82;border-color:#E39A82;color:#13221A}form{margin:16px 0}label{display:block;margin:20px 0 6px}
textarea{width:100%;box-sizing:border-box;font:inherit;padding:12px;border-radius:12px;border:1px solid #2C4236;background:#1A2C22;color:#EFE4D4}
</style></head><body><main><h1>${titre}</h1>${brut ? corps : `<p>${esc(corps)}</p>`}<p style="margin-top:32px"><a href="https://alsaweb.fr">alsaweb.fr</a></p></main></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } });
}
