import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

// Suppression d'une inscription. Il n'y a pas de statut "confirmé/en
// attente/annulé" à gérer : une inscription existe ou n'existe pas.
// Supprimer une inscription libère mécaniquement une place, puisque la
// capacité restante est toujours recomptée en direct depuis cette table
// (jamais un compteur stocké à part).
export async function DELETE(context) {
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

    const { searchParams } = new URL(context.request.url);
    const id = searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: "Le paramètre id est requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const registration = await db.prepare(
      `SELECT i.first_name, i.last_name, e.title AS event_title
       FROM inscriptions i JOIN evenements e ON e.id = i.event_id
       WHERE i.id = ?`
    ).bind(id).first();
    if (!registration) {
      return new Response(JSON.stringify({ error: "Inscription introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM inscriptions WHERE id = ?").bind(id).run();
    await logActivity(
      db, context, user,
      "Suppression d'une inscription",
      `${registration.first_name} ${registration.last_name} — ${registration.event_title}`
    );

    return new Response(JSON.stringify({ success: true, message: "Inscription supprimée." }), {
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
