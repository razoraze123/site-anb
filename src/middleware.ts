import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/auth.js';
import { applySecurityHeaders } from './lib/securityHeaders.js';

// Routes protégées qui nécessitent une session authentifiée
const PROTECTED_ROUTES = [
  '/admin',
  '/superadmin',
  '/editeur',
];

// Routes protégées selon le rôle
const ROLE_REQUIRED: Record<string, string[]> = {
  '/admin': ['admin', 'super_admin'],
  '/superadmin': ['super_admin'],
  '/editeur': ['admin', 'super_admin', 'editeur'],
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // --- Protection des routes sensibles ---
  const protectedMatch = PROTECTED_ROUTES.find(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  if (protectedMatch) {
    // getSessionUser() (lib/auth.js) revérifie statut/role en D1, pas
    // seulement la session KV — même fonction que requireRole(), pour que
    // page et API réagissent de façon identique (Correction P0.4).
    const user = await getSessionUser(context);
    if (!user) {
      return applySecurityHeaders(context.redirect('/connexion?redirect=' + encodeURIComponent(pathname)));
    }
    const allowedRoles = ROLE_REQUIRED[protectedMatch];
    if (allowedRoles && !allowedRoles.includes((user as any).role)) {
      // Connecté mais pas le bon rôle
      return applySecurityHeaders(new Response('Accès interdit.', { status: 403 }));
    }
  }

  // Headers de sécurité (Correction P1.1, audit-auth.md §1/§12/§18) — pour
  // TOUTES les réponses dynamiques (pages ET API), pas seulement les
  // routes protégées ci-dessus : public/_headers ne couvre que les pages
  // statiques/prérendues, ce middleware couvre tout le reste.
  const response = await next();
  return applySecurityHeaders(response);
});
