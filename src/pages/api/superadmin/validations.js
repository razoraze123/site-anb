import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

// File d'attente : actualités soumises par un éditeur (statut 'En attente',
// posé par PUT /api/editeur/submit.js).
export async function GET(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = await db.prepare(
      `SELECT a.id, a.title, a.excerpt, a.category, a.bg_gradient, a.status, a.created_at,
              u.nom AS auteur_nom
       FROM actualites a
       LEFT JOIN utilisateurs u ON u.id = a.auteur_id
       WHERE a.status = 'En attente'
       ORDER BY a.created_at ASC`
    ).all();

    return new Response(JSON.stringify({ items: result.results }), {
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

// action: 'approve' -> publie ; 'return' -> renvoie à l'éditeur (statut
// 'Renvoyé') avec un commentaire stocké sur l'article (actualites.
// commentaire_retour) pour qu'il le voie sur son tableau de bord.
export async function PUT(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { id, action, comment } = body;

    if (!id || !['approve', 'return'].includes(action)) {
      return new Response(JSON.stringify({ error: "Les paramètres id et action ('approve' ou 'return') sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const article = await db.prepare("SELECT title FROM actualites WHERE id = ?").bind(id).first();
    if (!article) {
      return new Response(JSON.stringify({ error: "Contenu introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (action === 'approve') {
      await db.prepare("UPDATE actualites SET status = 'Publié', commentaire_retour = NULL WHERE id = ?").bind(id).run();
      await logActivity(db, context, user, "Validation de contenu", article.title);
    } else {
      const finalComment = comment || 'Des ajustements sont requis.';
      await db.prepare("UPDATE actualites SET status = 'Renvoyé', commentaire_retour = ? WHERE id = ?").bind(finalComment, id).run();
      await logActivity(db, context, user, "Retour de contenu", `${article.title} : ${finalComment}`);
    }

    return new Response(JSON.stringify({ success: true, message: action === 'approve' ? 'Contenu approuvé et publié.' : 'Contenu renvoyé avec commentaire.' }), {
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
