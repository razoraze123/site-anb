import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { hashPassword } from "../../../lib/password.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

export async function GET(context) {
  const user = await requireRole(context, ['super_admin']);
  if (!user) return unauthorized();
  return new Response(JSON.stringify({ id: user.id, nom: user.nom, email: user.email, role: user.role }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// Modifie le profil de l'utilisateur connecté (lui-même uniquement, pas de
// paramètre id : c'est délibérément limité au compte en session).
export async function PUT(context) {
  try {
    const user = await requireRole(context, ['super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { nom, email, password } = body;

    if (!nom && !email && !password) {
      return new Response(JSON.stringify({ error: "Rien à modifier : fournissez nom, email ou password." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (password && password.length < 8) {
      return new Response(JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (nom) await db.prepare("UPDATE utilisateurs SET nom = ? WHERE id = ?").bind(nom, user.id).run();
    if (email) await db.prepare("UPDATE utilisateurs SET email = ? WHERE id = ?").bind(email, user.id).run();
    if (password) {
      const hashed = await hashPassword(password);
      await db.prepare("UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?").bind(hashed, user.id).run();
    }

    // La session doit refléter le nom/email à jour (utilisés par le middleware
    // et affichés côté client).
    const updatedUser = { ...user, ...(nom && { nom }), ...(email && { email }) };
    context.session.set('user', updatedUser);

    await logActivity(db, context, updatedUser, "Modification du profil", password ? "Mot de passe changé" : "Informations mises à jour");

    return new Response(JSON.stringify({ success: true, message: "Profil enregistré." }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    const message = /UNIQUE/i.test(error.message)
      ? "Un compte existe déjà avec cet e-mail."
      : error.message;
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
