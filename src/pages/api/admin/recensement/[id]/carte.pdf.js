import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../../../lib/auth.js";
import { genererPdfCarte } from "../../../../../lib/carteAdherent.js";

export const prerender = false;

// Téléchargement ADMIN de la carte adhérent — protégé par la session admin
// existante (comme toutes les routes /api/admin/*), pas de token HMAC ici :
// la session authentifiée suffit déjà, un deuxième mécanisme serait une
// duplication inutile de la protection.
export async function GET(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const id = Number(context.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return new Response(JSON.stringify({ error: "Identifiant invalide." }), {
        status: 400,
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
      // Même générateur que la route publique (lib/carteAdherent.js) :
      // aucune mise en page dupliquée entre les deux routes.
      pdfBytes = await genererPdfCarte(env, context.request.url, membre);
    } catch (pdfError) {
      console.error("Génération de la carte PDF (admin) échouée :", pdfError);
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
