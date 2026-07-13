import { env } from "cloudflare:workers";
import { isRateLimited, tooManyRequests } from "../../lib/rateLimit.js";

export const prerender = false;

export async function POST(context) {
  try {
    if (await isRateLimited(context.request, { bucket: 'inscriptions', limit: 5, windowSeconds: 600 })) {
      return tooManyRequests();
    }

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { event_id, first_name } = body;

    if (!event_id || !first_name || !first_name.trim()) {
      return new Response(JSON.stringify({ error: "Le prénom est obligatoire." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { results: eventRows } = await db.prepare(
      "SELECT id, status, registered_count, max_places FROM evenements WHERE id = ?"
    ).bind(event_id).all();

    const event = eventRows[0];
    if (!event) {
      return new Response(JSON.stringify({ error: "Événement introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (event.status === 'Complet' || event.status === 'Annulé' || event.registered_count >= event.max_places) {
      return new Response(JSON.stringify({ error: "Cet événement n'accepte plus d'inscriptions." }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare(
      `INSERT INTO inscriptions (event_id, first_name, last_name, email, phone, status)
       VALUES (?, ?, '', '', '', 'Confirmé')`
    ).bind(event_id, first_name.trim()).run();

    await db.prepare(
      "UPDATE evenements SET registered_count = registered_count + 1 WHERE id = ?"
    ).bind(event_id).run();

    return new Response(JSON.stringify({ success: true }), {
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
