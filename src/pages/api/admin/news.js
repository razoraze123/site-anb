import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

// Traduit les erreurs D1 brutes (ex. "D1_ERROR: UNIQUE constraint failed:
// actualites.slug: SQLITE_CONSTRAINT...") en message compréhensible. Le
// slug est dérivé automatiquement du titre côté client — un conflit
// signifie donc concrètement "un autre article a déjà (presque) ce titre".
function friendlyDbError(error) {
  if (/UNIQUE constraint failed: actualites\.slug/.test(error.message)) {
    return "Un autre article a déjà cette adresse (souvent parce que le titre est identique ou très proche). Modifiez le titre et réessayez.";
  }
  return error.message;
}

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
    const isConflict = /UNIQUE constraint failed/.test(error.message);
    return new Response(JSON.stringify({ error: friendlyDbError(error) }), {
      status: isConflict ? 409 : 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Suppression définitive d'une actualité. Réservée à admin/super_admin :
// un éditeur ne supprime pas, même ses propres brouillons (garde-fou
// volontaire — il peut les laisser en brouillon).
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

    const article = await db.prepare("SELECT title FROM actualites WHERE id = ?").bind(id).first();
    if (!article) {
      return new Response(JSON.stringify({ error: "Actualité introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM actualites WHERE id = ?").bind(id).run();
    await logActivity(db, context, user, "Suppression d'une actualité", article.title);

    return new Response(JSON.stringify({ success: true, message: "Actualité supprimée." }), {
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
    const { id, title, slug, excerpt, content, category, status, bg_gradient } = body;

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
    // bg_gradient : image de couverture (URL R2) ou dégradé CSS. Oubliée à
    // tort de ce UPDATE jusqu'ici — seule la création (POST) l'enregistrait,
    // donc changer l'image d'un article existant via "Modifier" n'avait
    // jamais d'effet réel en base.
    const bg = bg_gradient || "linear-gradient(150deg,#176B4D,#1F2925)";
    // Bascule Publié <-> Archivé, réservée à admin/super-admin (un éditeur
    // ne passe jamais par ce champ — son statut suit uniquement le circuit
    // brouillon -> soumission -> validation, géré par d'autres routes).
    const allowStatusChange = user.role !== 'editeur' && ['Publié', 'Archivé'].includes(status);

    // Update in D1
    const statement = allowStatusChange
      ? db.prepare("UPDATE actualites SET title = ?, slug = ?, excerpt = ?, content = ?, category = ?, bg_gradient = ?, status = ? WHERE id = ?")
          .bind(title, slug, excerpt, content, cat, bg, status, id)
      : db.prepare("UPDATE actualites SET title = ?, slug = ?, excerpt = ?, content = ?, category = ?, bg_gradient = ? WHERE id = ?")
          .bind(title, slug, excerpt, content, cat, bg, id);

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
    const isConflict = /UNIQUE constraint failed/.test(error.message);
    return new Response(JSON.stringify({ error: friendlyDbError(error) }), {
      status: isConflict ? 409 : 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
