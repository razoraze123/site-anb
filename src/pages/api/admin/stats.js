import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { getPeriodStats } from "../../../lib/stats.js";

export const prerender = false;

// Statistiques Admin — restaurée sur la structure de la maquette d'origine
// (commit fa971e8 : sélecteur de période + 4 cartes + "Visites par
// semaine"), après l'audit Git qui a confirmé la dérive introduite par
// f7c44fe. Mêmes définitions et même route de calcul que Statistiques
// globales Super Admin (api/superadmin/stats.js) : getPeriodStats()
// (lib/stats.js) est la source unique pour "Inscriptions aux événements"
// et "Nouvelles personnes recensées", filtrées par période — jamais de
// notion de "confirmation" pour les inscriptions (absente du modèle
// métier depuis c68baca).
//
// Route dédiée (et non une extension d'api/superadmin/stats.js) : Admin
// n'a pas accès aux champs de gouvernance de cette dernière, et cette
// page ne doit renvoyer que ce qui lui est strictement nécessaire.
const PERIOD_DAYS = { '7': 7, '30': 30, '90': 90, '365': 365 };

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

    const { searchParams } = new URL(context.request.url);
    const days = PERIOD_DAYS[searchParams.get('period')] || 30;

    const periodStats = await getPeriodStats(db, days);

    return new Response(JSON.stringify({
      period_days: days,
      period_stats: periodStats,
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
