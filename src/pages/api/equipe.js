import { env } from "cloudflare:workers";

export const prerender = false;

// Lecture publique (pas d'auth) du bureau/équipe — equipe est la source
// de vérité de /association (remplace demo-data.ts teamMembers). Ne
// renvoie que les membres actifs, triés par ordre d'affichage.
export async function GET() {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ membres: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = await db.prepare(
      "SELECT id, nom, fonction, photo, ordre FROM equipe WHERE actif = 1 ORDER BY ordre ASC, id ASC"
    ).all();

    // URL déduite de `photo` (clé R2) via la route déjà existante
    // /api/media/[key].js — jamais de photo si le champ est vide.
    const membres = result.results.map((m) => ({
      ...m,
      photo_url: m.photo ? `/api/media/${m.photo}` : null,
    }));

    return new Response(JSON.stringify({ membres }), {
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
