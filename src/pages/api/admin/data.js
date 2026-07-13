import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";

export const prerender = false;

export async function GET(context) {
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

    // Retrieve all datasets
    const actualitesRes = await db.prepare("SELECT * FROM actualites ORDER BY created_at DESC").all();
    const evenementsRes = await db.prepare(
      `SELECT id, title, date, place, category, max_places, status, bg_gradient, tab, created_at,
        (SELECT COUNT(*) FROM inscriptions i WHERE i.event_id = evenements.id AND i.status != 'Annulé') AS registered_count
       FROM evenements ORDER BY created_at DESC`
    ).all();
    const inscriptionsRes = await db.prepare("SELECT * FROM inscriptions ORDER BY created_at DESC").all();
    const messagesRes = await db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
    const recensementRes = await db.prepare("SELECT * FROM recensement ORDER BY created_at DESC").all();

    return new Response(JSON.stringify({
      actualites: actualitesRes.results,
      evenements: evenementsRes.results,
      inscriptions: inscriptionsRes.results,
      messages: messagesRes.results,
      recensement: recensementRes.results
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
