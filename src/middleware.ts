import { defineMiddleware } from 'astro:middleware';

// Routes protégées qui nécessitent une session authentifiée
const PROTECTED_ROUTES = [
  '/admin',
  '/superadmin',
  '/editeur',
];

// Routes protégées selon le rôle
const ROLE_REQUIRED: Record<string, string[]> = {
  '/admin': ['admin', 'superadmin'],
  '/superadmin': ['superadmin'],
  '/editeur': ['admin', 'superadmin', 'editeur'],
};

// Cache les pages SSR qui lisent D1 à chaque visite (événements, actualités)
const CACHEABLE_PATHS = new Set(['/evenements', '/actualites']);
const CACHE_TTL_SECONDS = 120;

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

  // --- Cache Cloudflare pour les pages publiques SSR ---
  if (request.method === 'GET' && CACHEABLE_PATHS.has(pathname)) {
    const cache = caches.default;
    const cached = await cache.match(request);
    if (cached) return new Response(cached.body, cached);

    const response = await next();
    if (response.status !== 200) return response;

    const cachedResponse = new Response(response.body, response);
    cachedResponse.headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}`);

    const putPromise = cache.put(request, cachedResponse.clone());
    const cfContext = (context.locals as any)?.cfContext;
    if (cfContext?.waitUntil) cfContext.waitUntil(putPromise);

    return cachedResponse;
  }

  return next();
});
