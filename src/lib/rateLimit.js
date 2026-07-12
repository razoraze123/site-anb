import { env } from "cloudflare:workers";

// Throttle simple par IP, fenêtre fixe, via KV (RATE_LIMIT).
// Écrit seulement tant que la limite n'est pas atteinte : au pire `limit`
// écritures par IP et par fenêtre, pas une par requête bloquée.
export async function isRateLimited(request, { bucket, limit, windowSeconds }) {
  const kv = env.RATE_LIMIT;
  if (!kv) return false; // fail-open si le binding n'est pas dispo (ex: dev sans KV)

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `${bucket}:${ip}:${windowStart}`;

  try {
    const current = await kv.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) return true;

    await kv.put(key, String(count + 1), { expirationTtl: windowSeconds + 5 });
    return false;
  } catch {
    // Quota KV dépassé ou erreur transitoire : on bloque par prudence
    // plutôt que de laisser passer un flux non maîtrisé.
    return true;
  }
}

export function tooManyRequests() {
  return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
    status: 429,
    headers: { "Content-Type": "application/json" }
  });
}
