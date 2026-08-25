import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

// Suppression définitive d'un message. Réservée à admin/super_admin, et
// uniquement pour un message déjà archivé — garde-fou volontaire côté
// serveur (pas seulement caché côté front) pour éviter qu'on supprime un
// message actif par erreur ou via un appel direct à l'API.
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

    const message = await db.prepare("SELECT from_name, subject, status FROM messages WHERE id = ?").bind(id).first();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (message.status !== 'Archivé') {
      return new Response(JSON.stringify({ error: "Seul un message déjà archivé peut être supprimé." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
    await logActivity(db, context, user, "Suppression d'un message", `${message.from_name} — ${message.subject}`);

    return new Response(JSON.stringify({ success: true, message: "Message supprimé." }), {
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

export async function PUT(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { id, status } = body;

    if (id === undefined || !status) {
      return new Response(JSON.stringify({ error: "Les paramètres id et status sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Update statement
    const statement = db.prepare(
      "UPDATE messages SET status = ? WHERE id = ?"
    ).bind(status, id);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: `Statut du message mis à jour : ${status}`,
      data: result
    }), {
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
