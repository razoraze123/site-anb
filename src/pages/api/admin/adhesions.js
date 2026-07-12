import { env } from "cloudflare:workers";

export const prerender = false;

export async function PUT(context) {
  try {
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
      "UPDATE adhesions SET status = ? WHERE id = ?"
    ).bind(status, id);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: `Statut de l'adhésion mis à jour : ${status}`,
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
