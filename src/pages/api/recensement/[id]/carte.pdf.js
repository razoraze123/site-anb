import { env } from "cloudflare:workers";
import { verifierToken, genererPdfCarte } from "../../../../lib/carteAdherent.js";

export const prerender = false;

// Téléchargement PUBLIC de la carte adhérent — le visiteur n'a jamais de
// compte/session (voir audit : aucun système d'authentification adhérent
// n'existe). Seul un token HMAC valide (généré une fois par
// POST /api/recensement et jamais stocké, voir lib/carteAdherent.js)
// autorise l'accès : un id seul, sans le bon token, est insuffisant —
// empêche l'énumération triviale des id (IDOR) qui exposerait le
// prénom/nom d'autres adhérents.
export async function GET(context) {
  try {
    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return new Response(JSON.stringify({ error: "Identifiant invalide." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const token = new URL(context.request.url).searchParams.get('t');
    if (!token) {
      return new Response(JSON.stringify({ error: "Token manquant." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const valide = await verifierToken(env, id, token);
    if (!valide) {
      return new Response(JSON.stringify({ error: "Lien de téléchargement invalide." }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const membre = await db.prepare(
      "SELECT id, first_name, last_name, status, created_at FROM recensement WHERE id = ?"
    ).bind(id).first();

    if (!membre) {
      return new Response(JSON.stringify({ error: "Adhérent introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    let pdfBytes;
    try {
      pdfBytes = await genererPdfCarte(env, context.request.url, membre);
    } catch (pdfError) {
      console.error("Génération de la carte PDF (public) échouée :", pdfError);
      return new Response(JSON.stringify({ error: "La génération de la carte a échoué. Réessayez." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="carte-adherent-${id}.pdf"`,
        // Données personnelles + lien à usage unique conceptuel : jamais de
        // cache navigateur ni CDN sur cette réponse.
        "Cache-Control": "private, no-store",
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
