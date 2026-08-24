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

// Hiérarchie des rôles : "Super Admin = Admin + privilèges supplémentaires".
// Un rôle listé dans `roles` donne aussi accès à tout rôle qui hérite de
// lui — super_admin hérite d'admin, donc demander 'admin' laisse aussi
// passer super_admin. 'super_admin' et 'editeur' n'héritent de rien :
// demander l'un des deux reste strictement réservé à ce rôle.
//
// Rétrocompatible par construction : un appel existant qui liste déjà
// explicitement tous les rôles voulus (ex. ['admin', 'super_admin']) donne
// exactement le même ensemble de rôles autorisés qu'avant — cette table ne
// fait qu'ajouter automatiquement ce qui, jusqu'ici, devait être écrit à la
// main à chaque appel.
const ROLE_HIERARCHY = {
  admin: ['admin', 'super_admin'],
  super_admin: ['super_admin'],
  editeur: ['editeur'],
};

// Retourne l'utilisateur en session si son rôle est autorisé, sinon null.
export async function requireRole(context, roles) {
  const user = await getSessionUser(context);
  if (!user) return null;
  const allowedRoles = new Set(roles.flatMap((role) => ROLE_HIERARCHY[role] || [role]));
  if (!allowedRoles.has(user.role)) return null;
  return user;
}
