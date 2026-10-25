import { env } from "cloudflare:workers";

// Throttle simple par identifiant, fenêtre fixe, via KV (RATE_LIMIT).
// Écrit seulement tant que la limite n'est pas atteinte : au pire `limit`
// écritures par identifiant et par fenêtre, pas une par requête bloquée.
//
// `identifier` (optionnel) : par défaut l'IP (`cf-connecting-ip`), adapté
// aux endpoints publics non authentifiés. Un appelant peut fournir un
// identifiant explicite à la place — ex. l'id de session d'un admin déjà
// authentifié (POST /api/admin/messages) — pour ne pas throttler par IP
// une route où l'IP est soit non pertinente (plusieurs admins derrière la
// même IP), soit absente en local (voir cf-connecting-ip ci-dessous).
// Ne change rien pour les appelants existants qui ne passent pas ce
// paramètre : comportement par IP identique à avant.
export async function isRateLimited(request, { bucket, limit, windowSeconds, identifier }) {
  const kv = env.RATE_LIMIT;
  if (!kv) return false; // fail-open si le binding n'est pas dispo (ex: dev sans KV)

  const id = identifier || request.headers.get('cf-connecting-ip') || 'unknown';
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `${bucket}:${id}:${windowStart}`;

  try {
    const current = await kv.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) return true;

    // Cloudflare KV impose expirationTtl >= 60s : pour une fenêtre courte
    // (ex. windowSeconds:30), windowSeconds + 5 tombe sous ce plancher et
    // kv.put() rejette systématiquement l'écriture (400 "Expiration TTL
    // must be at least 60"), ce qui fait échouer chaque appel dans le
    // catch ci-dessous (fail-closed) sans jamais écrire la clé — bug
    // constaté en réel sur le bucket 'admin-reply'. Math.max plafonne
    // uniquement la durée de vie KV ; le découpage en fenêtres
    // (windowStart ci-dessus) reste, lui, exactement à windowSeconds.
    await kv.put(key, String(count + 1), { expirationTtl: Math.max(windowSeconds + 5, 60) });
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
