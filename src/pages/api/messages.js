import { env } from "cloudflare:workers";
import { isRateLimited, tooManyRequests } from "../../lib/rateLimit.js";

export const prerender = false;

// Formulaire de contact public (src/pages/contact.astro) — Option A du
// workflow Messages : ANB collecte le message en base, la réponse part
// ensuite du client e-mail de l'admin (mailto:, voir adminContent.js
// renderMessages()). Aucun envoi d'e-mail automatique depuis cette route.
//
// category : le formulaire public n'a pas de sélecteur de catégorie
// (contrairement aux messages de démo du seed) — 'Contact' par défaut,
// seule valeur cohérente pour un message générique du site public.
const MAX_LENGTHS = { from_name: 120, email: 200, subject: 200, content: 5000 };

export async function POST(context) {
  try {
    if (await isRateLimited(context.request, { bucket: 'messages', limit: 5, windowSeconds: 600 })) {
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
    const from_name = (body.nom || '').trim();
    const email = (body.email || '').trim();
    const subject = (body.sujet || '').trim();
    const content = (body.message || '').trim();

    if (!from_name || !email || !content) {
      return new Response(JSON.stringify({ error: "Les champs nom, email et message sont obligatoires." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: "Format d'adresse email invalide." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (from_name.length > MAX_LENGTHS.from_name || email.length > MAX_LENGTHS.email
      || subject.length > MAX_LENGTHS.subject || content.length > MAX_LENGTHS.content) {
      return new Response(JSON.stringify({ error: "Un ou plusieurs champs dépassent la longueur autorisée." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare(
      `INSERT INTO messages (from_name, email, subject, category, status, content)
       VALUES (?, ?, ?, 'Contact', 'Non lu', ?)`
    ).bind(
      from_name,
      email.toLowerCase(),
      subject || '(Sans objet)',
      content
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: "Votre message a bien été envoyé."
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
