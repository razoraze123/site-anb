import { env } from "cloudflare:workers";

export const prerender = false;

export async function DELETE(context) {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "ID manquant pour la suppression." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Delete from D1
    await db.prepare("DELETE FROM recensement WHERE id = ?").bind(id).run();

    return new Response(JSON.stringify({
      success: true,
      message: "Recensement supprimé avec succès."
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
