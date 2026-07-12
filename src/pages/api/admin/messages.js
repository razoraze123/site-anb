import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";

export const prerender = false;

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
