import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";

export const prerender = false;

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
