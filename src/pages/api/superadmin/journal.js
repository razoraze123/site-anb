import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";

export const prerender = false;

// Lecture seule — chaque action sensible des routes /api/superadmin/* et
// /api/admin/* s'y ajoute automatiquement via lib/journal.js.
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

    const result = await db.prepare(
      "SELECT id, utilisateur_email, role, action, details, adresse_ip, created_at FROM journal_activite ORDER BY created_at DESC LIMIT 200"
    ).all();

    return new Response(JSON.stringify({ logs: result.results }), {
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
