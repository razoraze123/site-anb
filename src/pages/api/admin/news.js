import { env } from "cloudflare:workers";

export const prerender = false;

export async function POST(context) {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { title, slug, excerpt, content, category, auteur_id, status, bg_gradient } = body;

    if (!title || !slug || !excerpt || !content) {
      return new Response(JSON.stringify({ error: "Les paramètres title, slug, excerpt et content sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const cat = category || "Communauté";
    const authId = auteur_id || 2;
    const stat = status || "Publié";
    const bg = bg_gradient || "linear-gradient(150deg,#176B4D,#1F2925)";

    const statement = db.prepare(
      "INSERT INTO actualites (title, slug, excerpt, content, category, auteur_id, status, bg_gradient) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(title, slug, excerpt, content, cat, authId, stat, bg);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: "Actualité créée avec succès !",
      data: result
    }), {
      status: 201,
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
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { id, title, slug, excerpt, content, category } = body;

    if (!id || !title || !slug || !excerpt || !content) {
      return new Response(JSON.stringify({ error: "Les paramètres id, title, slug, excerpt et content sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const cat = category || "Communauté";

    // Update in D1
    const statement = db.prepare(
      "UPDATE actualites SET title = ?, slug = ?, excerpt = ?, content = ?, category = ? WHERE id = ?"
    ).bind(title, slug, excerpt, content, cat, id);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: "Actualité modifiée avec succès !",
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
