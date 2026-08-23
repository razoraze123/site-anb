import { env } from "cloudflare:workers";
import { isRateLimited, tooManyRequests } from "../../lib/rateLimit.js";

export const prerender = false;

export async function POST(context) {
  try {
    if (await isRateLimited(context.request, { bucket: 'inscriptions', limit: 5, windowSeconds: 600 })) {
      return tooManyRequests();
    }

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { event_id, first_name, last_name } = body;

    if (!event_id || !first_name || !first_name.trim() || !last_name || !last_name.trim()) {
      return new Response(JSON.stringify({ error: "Le prénom et le nom sont obligatoires." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Insertion atomique : les règles métier (événement ouvert, inscriptions
    // ouvertes, capacité non atteinte) sont vérifiées DANS la même requête
    // SQL que l'insertion, pas dans un SELECT séparé fait avant. Un simple
    // "je compte, je compare, j'insère" en trois étapes laisserait une
    // fenêtre où deux inscriptions concurrentes pourraient toutes les deux
    // passer le contrôle de capacité avant que l'une des deux insère
    // (dépassement possible sur la toute dernière place). En combinant tout
    // en un seul INSERT ... SELECT ... WHERE, la vérification et
    // l'écriture sont une seule opération atomique côté base.
    const result = await db.prepare(
      `INSERT INTO inscriptions (event_id, first_name, last_name)
       SELECT ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM evenements
         WHERE id = ?
           AND status = 'Ouvert'
           AND inscriptions_ouvertes = 1
           AND (SELECT COUNT(*) FROM inscriptions WHERE event_id = evenements.id) < max_places
       )`
    ).bind(event_id, first_name.trim(), last_name.trim(), event_id).run();

    if (result.meta.changes === 0) {
      // L'insertion n'a rien écrit : soit l'événement n'existe pas, soit
      // une des règles métier bloque l'inscription. On relit l'état pour
      // renvoyer un message utile (cette lecture ne sert qu'au message
      // d'erreur, elle ne conditionne plus l'écriture).
      const event = await db.prepare("SELECT status, inscriptions_ouvertes, max_places FROM evenements WHERE id = ?").bind(event_id).first();
      if (!event) {
        return new Response(JSON.stringify({ error: "Événement introuvable." }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      let error = "Cet événement n'accepte plus d'inscriptions.";
      if (event.status === 'Annulé') error = "Cet événement a été annulé.";
      else if (event.status === 'Terminé') error = "Cet événement est déjà terminé.";
      else if (!event.inscriptions_ouvertes) error = "Les inscriptions sont fermées pour cet événement.";
      else error = "Cet événement est complet.";

      return new Response(JSON.stringify({ error }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
