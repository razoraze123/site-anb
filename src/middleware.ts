import { defineMiddleware } from 'astro:middleware';

// Cache les pages SSR qui lisent D1 à chaque visite (évenements, actualités)
// dans le Cache API de Cloudflare, pour éviter de réinvoquer le Worker + D1
// à chaque visiteur. N'affecte aucune autre route.
const CACHEABLE_PATHS = new Set(['/evenements', '/actualites']);
const CACHE_TTL_SECONDS = 120;

export const onRequest = defineMiddleware(async (context, next) => {
  const { request } = context;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !CACHEABLE_PATHS.has(url.pathname)) {
    return next();
  }

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return new Response(cached.body, cached);

  const response = await next();
  if (response.status !== 200) return response;

  const cachedResponse = new Response(response.body, response);
  cachedResponse.headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}`);

  const putPromise = cache.put(request, cachedResponse.clone());
  const cfContext = context.locals?.cfContext;
  if (cfContext?.waitUntil) {
    cfContext.waitUntil(putPromise);
  }

  return cachedResponse;
});
