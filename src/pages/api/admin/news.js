import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";

export const prerender = false;

export async function POST(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin', 'editeur']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { title, slug, excerpt, content, category, status, bg_gradient } = body;

    if (!title || !slug || !excerpt || !content) {
      return new Response(JSON.stringify({ error: "Les paramètres title, slug, excerpt et content sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const cat = category || "Communauté";
    // L'auteur est toujours l'utilisateur authentifié en session — jamais
    // une valeur envoyée par le client (sinon n'importe quel admin pourrait
    // attribuer un article à quelqu'un d'autre).
    const authId = user.id;
    // Un éditeur ne peut créer que des brouillons — jamais publier
    // directement, quoi que le client envoie dans `status`.
    const stat = user.role === 'editeur' ? 'Brouillon' : (status || "Publié");
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
    const user = await requireRole(context, ['admin', 'super_admin', 'editeur']);
    if (!user) return unauthorized();

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

    // Un éditeur ne peut modifier que ses propres brouillons/retours — pas
    // un contenu déjà soumis, publié, ou appartenant à quelqu'un d'autre.
    if (user.role === 'editeur') {
      const existing = await db.prepare("SELECT auteur_id, status FROM actualites WHERE id = ?").bind(id).first();
      if (!existing || existing.auteur_id !== user.id || !['Brouillon', 'Renvoyé'].includes(existing.status)) {
        return new Response(JSON.stringify({ error: "Vous ne pouvez modifier que vos propres brouillons." }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
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
