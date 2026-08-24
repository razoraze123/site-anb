import { env } from "cloudflare:workers";

export const prerender = false;

// Lecture publique (pas d'auth) de la galerie — media_galerie est
// désormais la source de vérité (remplace demo-data.ts fullGallery/
// homeGallery). Consommée par /galerie et la section galerie de la home,
// et réutilisée telle quelle par l'interface d'administration (aucune
// donnée de ce tableau n'est sensible : ce sont des métadonnées destinées
// à être publiques).
export async function GET() {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ medias: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const result = await db.prepare(
      "SELECT id, nom_fichier, titre, texte_alternatif, credit, type, taille_octets, created_at FROM media_galerie ORDER BY created_at DESC"
    ).all();

    // L'URL publique se déduit de nom_fichier (clé R2 réelle) via la route
    // déjà existante /api/media/[key].js — jamais une deuxième route de
    // service de fichiers.
    const medias = result.results.map((m) => ({ ...m, url: `/api/media/${m.nom_fichier}` }));

    return new Response(JSON.stringify({ medias }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
