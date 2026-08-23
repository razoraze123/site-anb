import { env } from "cloudflare:workers";

export const prerender = false;

// Lecture publique (pas d'auth) des réglages identité/SEO éditables depuis
// le Super Admin (view-reglages -> src/pages/api/superadmin/settings.js).
// Valeurs de repli si la table est vide/indisponible, pour ne jamais casser
// l'affichage public.
const DEFAULTS = {
  identite_nom: 'Association des Nigériens à Bordeaux',
  identite_slogan: 'Ensemble, faire vivre la communauté nigérienne à Bordeaux.',
  identite_email: 'anbordeaux33@outlook.fr',
  identite_telephone: '07 58 62 42 84',
  seo_titre: 'ANB — Association des Nigériens à Bordeaux',
  seo_description: "Communauté nigérienne à Bordeaux : événements, entraide et accompagnement.",
};

export async function GET() {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ settings: DEFAULTS }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = await db.prepare("SELECT key, value FROM site_settings").all();
    const settings = { ...DEFAULTS };
    for (const row of result.results) {
      if (row.key in DEFAULTS && row.value) settings[row.key] = row.value;
    }

    return new Response(JSON.stringify({ settings }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Contenu public peu sensible, mis à jour rarement : léger cache
        // navigateur/CDN pour éviter une requête D1 à chaque chargement.
        "Cache-Control": "public, max-age=60",
      }
    });
  } catch {
    return new Response(JSON.stringify({ settings: DEFAULTS }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
}
