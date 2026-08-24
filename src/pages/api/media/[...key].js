import { env } from "cloudflare:workers";

export const prerender = false;

// Paramètre "rest" ([...key], pas [key]) : nécessaire pour servir les
// visuels fixes du site dont la clé R2 imposée contient un slash
// (site/home-hero.jpg, site/home-mission.jpg — voir index.astro).
// Reste 100% rétrocompatible avec les clés plates existantes
// (img-<timestamp>-<rand>.ext) utilisées par Actualités/Événements/
// Galerie/Équipe, qui n'ont qu'un seul segment.
export async function GET({ params }) {
  const key = params.key;
  const r2 = env.R2;

  if (!r2) {
    return new Response(JSON.stringify({ error: "Le bucket R2 n'est pas configuré dans env. R2." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const object = await r2.get(key);
    if (!object) {
      return new Response("Objet introuvable dans R2", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000");

    return new Response(object.body, { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
