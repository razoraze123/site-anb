import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";

export const prerender = false;

// Clés autorisées (voir seed dans db/schema.sql). Écrit dans site_settings ;
// les pages publiques (mentions-legales.astro, Layout SEO, ...) restent en
// dur pour l'instant et ne lisent pas encore cette table (itération future).
const ALLOWED_KEYS = [
  'identite_nom', 'identite_slogan', 'identite_email', 'identite_telephone',
  'seo_titre', 'seo_description',
];

export async function GET(context) {
  try {
    const user = await requireRole(context, ['super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = await db.prepare("SELECT key, value FROM site_settings").all();
    const settings = {};
    for (const row of result.results) settings[row.key] = row.value;

    return new Response(JSON.stringify({ settings }), {
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
    const user = await requireRole(context, ['super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const entries = Object.entries(body).filter(([key]) => ALLOWED_KEYS.includes(key));

    if (entries.length === 0) {
      return new Response(JSON.stringify({ error: `Aucune clé valide fournie. Clés autorisées : ${ALLOWED_KEYS.join(', ')}.` }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    for (const [key, value] of entries) {
      await db.prepare(
        "INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP"
      ).bind(key, String(value ?? '')).run();
    }

    await logActivity(db, context, user, "Modification des réglages du site", entries.map(([k]) => k).join(', '));

    return new Response(JSON.stringify({ success: true, message: "Réglages enregistrés." }), {
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
