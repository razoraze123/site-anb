import { env } from "cloudflare:workers";

export const prerender = false;

export async function GET(context) {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Retrieve all datasets
    const actualitesRes = await db.prepare("SELECT * FROM actualites ORDER BY created_at DESC").all();
    const evenementsRes = await db.prepare("SELECT * FROM evenements ORDER BY created_at DESC").all();
    const inscriptionsRes = await db.prepare("SELECT * FROM inscriptions ORDER BY created_at DESC").all();
    const adhesionsRes = await db.prepare("SELECT * FROM adhesions ORDER BY created_at DESC").all();
    const messagesRes = await db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
    const mediaGalerieRes = await db.prepare("SELECT * FROM media_galerie ORDER BY created_at DESC").all();
    const recensementRes = await db.prepare("SELECT * FROM recensement ORDER BY created_at DESC").all();

    return new Response(JSON.stringify({
      actualites: actualitesRes.results,
      evenements: evenementsRes.results,
      inscriptions: inscriptionsRes.results,
      adhesions: adhesionsRes.results,
      messages: messagesRes.results,
      media_galerie: mediaGalerieRes.results,
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
