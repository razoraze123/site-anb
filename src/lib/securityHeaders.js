// Valeurs de sécurité HTTP partagées — Correction P1.1 (audit-auth.md
// §1/§12/§18). Source de vérité unique côté JS, importée par
// src/middleware.ts pour les réponses dynamiques (pages protégées + API).
//
// ATTENTION — duplication partielle inévitable : public/_headers (pour les
// pages statiques/prérendues comme /connexion) est un fichier texte lu tel
// quel par Cloudflare au déploiement, il ne peut pas importer ce module JS.
// Toute modification ici doit être reportée à la main dans public/_headers.
//
// CSP pragmatique (pas de nonces) : style-src et script-src incluent
// 'unsafe-inline' — nécessaire car le projet utilise massivement des
// attributs style="" inline (des centaines d'occurrences) et quelques
// <script> inline sur les pages statiques (ex. connexion.astro). Une CSP
// stricte sans unsafe-inline casserait l'affichage de tout le site — voir
// l'analyse de faisabilité P1.1 pour le détail des vérifications faites.
export const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "frame-ancestors 'none'; " +
  "object-src 'none'; " +
  "base-uri 'self';";

// HSTS volontairement absent : le site répond aujourd'hui aussi bien en
// HTTP simple (non redirigé) qu'en HTTPS (vérifié par requête réelle,
// 2026-08-25) — l'ajouter maintenant risquerait de casser un accès HTTP
// encore actif. À ajouter seulement après mise en place d'une redirection
// HTTP -> HTTPS au niveau de la zone Cloudflare.
export const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function applySecurityHeaders(response) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
