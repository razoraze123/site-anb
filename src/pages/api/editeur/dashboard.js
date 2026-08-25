import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";

export const prerender = false;

// Contenus de l'utilisateur connecté uniquement (filtré par auteur_id) —
// alimente le tableau de bord et "Mes contenus" de l'espace Éditeur.
export async function GET(context) {
  try {
    const user = await requireRole(context, ['editeur', 'admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // slug/excerpt/content/bg_gradient inclus pour pouvoir pré-remplir le
    // formulaire de modification d'un brouillon/contenu renvoyé (image de
    // couverture comprise) sans requête séparée.
    const result = await db.prepare(
      "SELECT id, title, slug, excerpt, content, category, status, bg_gradient, commentaire_retour, created_at FROM actualites WHERE auteur_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all();

    const items = result.results;
    const counts = {
      brouillons: items.filter((i) => i.status === 'Brouillon').length,
      en_attente: items.filter((i) => i.status === 'En attente').length,
      renvoye: items.filter((i) => i.status === 'Renvoyé').length,
      publies: items.filter((i) => i.status === 'Publié').length,
    };

    return new Response(JSON.stringify({ items, counts }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
