// Helpers de session pour les routes /api/admin/* et les pages privées.
// La session est gérée par Astro (cookie signé, stockage KV via l'adaptateur
// Cloudflare) — voir context.session dans les API routes / Astro.session
// dans les pages.

import { env } from "cloudflare:workers";

// Revérifie l'état réel du compte en D1 à chaque requête (Correction P0.4,
// audit-auth.md §5/§9) : la session KV seule ne doit plus jamais suffire
// pour un compte désactivé, dont le rôle a changé, ou dont le mot de passe
// a été réinitialisé par un tiers pendant que sa session était encore
// ouverte. mot_de_passe_updated_at est comparé dans le même SELECT que
// statut/role, sans requête D1 supplémentaire (migration
// db/migration-2026-08-25-mot-de-passe-updated-at.sql). Un écart est
// traité exactement comme "pas de session" — même chemin que l'expiration
// de session (Correction P0.3) : middleware.ts redirige proprement (302),
// requireRole() renvoie 401 JSON.
//
// Fail-open volontaire si D1 est indisponible ou en erreur transitoire :
// on ne dégrade pas la disponibilité de tout le panneau admin pour un
// aléa infra — la vérification s'ajoute par-dessus la session déjà
// authentifiée, elle ne la remplace pas. Cohérent avec le fail-open déjà
// utilisé ailleurs dans le projet pour les mêmes raisons (rateLimit.js).
//
// N'affecte pas l'auto-édition (superadmin/profile.js) : ce chemin ne
// modifie jamais statut/role, uniquement nom/email/mot_de_passe — la
// revérification reste donc invisible pour un utilisateur qui modifie
// son propre profil.
export async function getSessionUser(context) {
  const sessionUser = (await context.session?.get('user')) ?? null;
  if (!sessionUser) return null;

  const db = env.DB;
  if (!db) return sessionUser;

  try {
    const current = await db
      .prepare('SELECT statut, role, mot_de_passe_updated_at FROM utilisateurs WHERE id = ?')
      .bind(sessionUser.id)
      .first();

    if (
      !current ||
      current.statut !== 'actif' ||
      current.role !== sessionUser.role ||
      current.mot_de_passe_updated_at !== sessionUser.mot_de_passe_updated_at
    ) {
      return null;
    }
  } catch {
    return sessionUser;
  }

  return sessionUser;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'Non autorisé.' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Protection CSRF (Correction P1.2, audit-auth.md §11/§13/§18). Pour les
// mutations (POST/PUT/DELETE/PATCH), vérifie que la requête provient bien
// de ce site — en complément du cookie de session SameSite=Lax déjà en
// place (qui bloque déjà l'essentiel du CSRF classique), pour refermer les
// cas limites (anciens navigateurs, comportements non standard). Les
// lectures (GET) ne sont jamais concernées : ce n'est pas une cible CSRF
// et ça n'affecte donc aucune des routes GET protégées par requireRole()
// (ex. GET /api/admin/data, GET /api/superadmin/users).
//
// L'origine attendue est dérivée de LA REQUÊTE ELLE-MÊME (context.request.url),
// jamais d'une valeur codée en dur : reste valide automatiquement si le
// site change de domaine (workers.dev aujourd'hui, domaine personnalisé
// demain), sans aucune configuration à maintenir.
//
// Choix assumé sur les en-têtes absents : Origin est envoyé de façon
// fiable par tous les navigateurs modernes sur une requête fetch()/XHR
// POST/PUT/DELETE, y compris en same-origin — le panneau admin de ce
// projet n'utilise que fetch() (jamais de <form> natif), donc le trafic
// légitime envoie toujours cet en-tête et n'est jamais affecté par cette
// règle. Une mutation sans Origin NI Referer est donc rejetée par défaut
// plutôt que laissée passer par prudence excessive.
export function checkOrigin(context) {
  const method = context.request.method.toUpperCase();
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return true;

  const headerValue = context.request.headers.get('origin') || context.request.headers.get('referer');
  if (!headerValue) return false;

  let requestOrigin;
  try {
    requestOrigin = new URL(headerValue).origin;
  } catch {
    return false;
  }

  const expectedOrigin = new URL(context.request.url).origin;
  return requestOrigin === expectedOrigin;
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
// checkOrigin() est vérifié avant même la session : une mutation refusée
// pour cause d'origine invalide ne doit rien révéler sur l'état de la
// session (comportement identique, qu'on soit connecté ou non).
export async function requireRole(context, roles) {
  if (!checkOrigin(context)) return null;
  const user = await getSessionUser(context);
  if (!user) return null;
  const allowedRoles = new Set(roles.flatMap((role) => ROLE_HIERARCHY[role] || [role]));
  if (!allowedRoles.has(user.role)) return null;
  return user;
}
