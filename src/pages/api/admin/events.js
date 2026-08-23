import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

// Suppression définitive d'un événement. Attention : le schéma déclare
// ON DELETE CASCADE sur inscriptions.event_id — supprimer un événement
// supprime donc aussi toutes ses inscriptions. On prévient l'appelant du
// nombre d'inscrits concernés pour qu'il puisse confirmer en connaissance
// de cause (voir le paramètre ?confirm=1).
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
    const confirmed = searchParams.get('confirm') === '1';
    if (!id) {
      return new Response(JSON.stringify({ error: "Le paramètre id est requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const event = await db.prepare("SELECT title FROM evenements WHERE id = ?").bind(id).first();
    if (!event) {
      return new Response(JSON.stringify({ error: "Événement introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { n: inscrits } = await db
      .prepare("SELECT COUNT(*) AS n FROM inscriptions WHERE event_id = ?")
      .bind(id)
      .first();

    // Garde-fou : on refuse la suppression tant que l'appelant n'a pas
    // explicitement confirmé la perte des inscriptions associées.
    if (inscrits > 0 && !confirmed) {
      return new Response(JSON.stringify({
        error: `Cet événement a ${inscrits} inscription(s). Les supprimer aussi ?`,
        needsConfirmation: true,
        inscrits,
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM evenements WHERE id = ?").bind(id).run();
    await logActivity(
      db, context, user,
      "Suppression d'un événement",
      inscrits > 0 ? `${event.title} (+ ${inscrits} inscription(s))` : event.title
    );

    return new Response(JSON.stringify({
      success: true,
      message: inscrits > 0
        ? `Événement supprimé, ainsi que ses ${inscrits} inscription(s).`
        : "Événement supprimé.",
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

export async function POST(context) {
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
    const { title, date, place, category, max_places, status, bg_gradient, tab } = body;

    if (!title || !date || !place) {
      return new Response(JSON.stringify({ error: "Les paramètres title, date et place sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Default values if omitted
    const cat = category || "Culture";
    const maxPl = max_places !== undefined ? max_places : 100;
    const stat = status || "Ouvert";
    const bg = bg_gradient || "linear-gradient(150deg,#E97824,#1F2925)";
    const tb = tab || "À venir";

    // Insert into D1 (registered_count is derived live from `inscriptions`, not stored)
    const statement = db.prepare(
      "INSERT INTO evenements (title, date, place, category, max_places, status, bg_gradient, tab) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(title, date, place, cat, maxPl, stat, bg, tb);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: "Événement créé avec succès !",
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
    const { id, title, date, place, category, max_places, status } = body;

    if (!id || !title || !date || !place) {
      return new Response(JSON.stringify({ error: "Les paramètres id, title, date et place sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const cat = category || "Culture";
    const maxPl = max_places !== undefined ? max_places : 100;
    const stat = status || "Ouvert";

    // Update in D1
    const statement = db.prepare(
      "UPDATE evenements SET title = ?, date = ?, place = ?, category = ?, max_places = ?, status = ? WHERE id = ?"
    ).bind(title, date, place, cat, maxPl, stat, id);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: "Événement modifié avec succès !",
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
