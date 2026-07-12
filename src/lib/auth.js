// Helpers de session pour les routes /api/admin/* et les pages privées.
// La session est gérée par Astro (cookie signé, stockage KV via l'adaptateur
// Cloudflare) — voir context.session dans les API routes / Astro.session
// dans les pages.

export async function getSessionUser(context) {
  return (await context.session?.get('user')) ?? null;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Non autorisé.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Retourne l'utilisateur en session si son rôle est autorisé, sinon null.
export async function requireRole(context, roles) {
  const user = await getSessionUser(context);
  if (!user || !roles.includes(user.role)) return null;
  return user;
}
