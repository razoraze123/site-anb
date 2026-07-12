import { env } from "cloudflare:workers";

export const prerender = false;

export async function POST(context) {
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { first_name, last_name, status, phone, email, origine, annee_arrivee, domaine, benevole, rgpd_consent } = body;

    // Validate required fields
    if (!first_name || !last_name || !status || !phone || !email) {
      return new Response(JSON.stringify({ error: "Les champs prénom, nom, statut, téléphone et email sont obligatoires." }), {
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

    if (!rgpd_consent) {
      return new Response(JSON.stringify({ error: "Vous devez accepter la politique de confidentialité pour vous recenser." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Anti-duplicate check : email already registered?
    const { results: existing } = await db.prepare(
      "SELECT id FROM recensement WHERE lower(email) = lower(?)"
    ).bind(email.trim()).all();

    if (existing.length > 0) {
      return new Response(JSON.stringify({
        error: "Cette adresse e-mail est déjà enregistrée dans notre recensement. Si vous souhaitez mettre à jour vos informations, contactez-nous directement.",
        duplicate: true
      }), {
        status: 409,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Insert into D1
    await db.prepare(
      `INSERT INTO recensement 
        (first_name, last_name, status, phone, email, origine, annee_arrivee, domaine, benevole, rgpd_consent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      first_name.trim(),
      last_name.trim(),
      status.trim(),
      phone.trim(),
      email.trim().toLowerCase(),
      (origine || '').trim(),
      (annee_arrivee || '').trim(),
      (domaine || '').trim(),
      benevole ? 1 : 0,
      rgpd_consent ? 1 : 0
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: "Recensement enregistré avec succès !"
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
