import { defineMiddleware } from 'astro:middleware';

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
    const user = (await context.session?.get('user')) ?? null;
    if (!user) {
      return context.redirect('/connexion?redirect=' + encodeURIComponent(pathname));
    }
    const allowedRoles = ROLE_REQUIRED[protectedMatch];
    if (allowedRoles && !allowedRoles.includes((user as any).role)) {
      // Connecté mais pas le bon rôle
      return new Response('Accès interdit.', { status: 403 });
    }
  }

  return next();
});
