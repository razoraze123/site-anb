import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

// Soumet un brouillon (ou un contenu renvoyé, corrigé) pour validation —
// repris ensuite par GET/PUT /api/superadmin/validations.js.
export async function PUT(context) {
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

    const body = await context.request.json();
    const { id } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: "Le paramètre id est requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Toujours son propre contenu, même pour un admin/super_admin qui
    // aurait créé un brouillon (cette route est une action "soumettre MON
    // brouillon", pas un pouvoir d'admin sur le contenu des autres).
    const article = await db.prepare("SELECT auteur_id, title, status FROM actualites WHERE id = ?").bind(id).first();
    if (!article || article.auteur_id !== user.id) {
      return new Response(JSON.stringify({ error: "Contenu introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!['Brouillon', 'Renvoyé'].includes(article.status)) {
      return new Response(JSON.stringify({ error: "Seul un brouillon ou un contenu renvoyé peut être soumis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("UPDATE actualites SET status = 'En attente', commentaire_retour = NULL WHERE id = ?").bind(id).run();
    await logActivity(db, context, user, "Soumission pour validation", article.title);

    return new Response(JSON.stringify({ success: true, message: "Contenu soumis pour validation." }), {
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
