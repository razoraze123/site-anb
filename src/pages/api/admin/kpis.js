import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { getCommonKpis } from "../../../lib/stats.js";

export const prerender = false;

// Source de vérité commune pour les 4 KPI partagés par les dashboards
// Admin et Super Admin (voir lib/stats.js pour les définitions exactes).
// Même route, même permission que le reste de l'espace admin/super-admin.
export async function GET(context) {
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

    const kpis = await getCommonKpis(db);

    return new Response(JSON.stringify(kpis), {
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
