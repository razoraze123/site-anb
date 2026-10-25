import { env } from "cloudflare:workers";
import { isRateLimited, tooManyRequests } from "../../lib/rateLimit.js";
import { sendEmail, ADMIN_NOTIFICATION_EMAIL, escapeHtml } from "../../lib/email.js";

export const prerender = false;

// Formulaire de contact public (src/pages/contact.astro) — ANB collecte le
// message en base, PUIS notifie l'admin par e-mail (best-effort, voir
// bloc sendEmail ci-dessous). La réponse au visiteur, elle, part
// désormais réellement depuis l'admin via Resend (POST
// /api/admin/messages, voir adminContent.js renderMessages()) — ce n'est
// plus l'ancien flux "Option A" (mailto: uniquement, voir
// db/migration-2026-08-25-messages-email.sql, décision remplacée).
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

    // Destinataire de la notification centralisé dans site_settings
    // (messages_notification_email, éditable depuis Super Admin > Réglages
    // du site), pas en dur — repli sur ADMIN_NOTIFICATION_EMAIL si la clé
    // n'existe pas encore (installation existante non reconfigurée) ou en
    // cas d'erreur D1. Jamais une valeur envoyée par le client.
    let notificationEmail = ADMIN_NOTIFICATION_EMAIL;
    try {
      const setting = await db.prepare("SELECT value FROM site_settings WHERE key = 'messages_notification_email'").first();
      if (setting?.value) notificationEmail = setting.value;
    } catch { /* garde le repli ci-dessus */ }

    // Notification best-effort : un échec Resend ne doit jamais empêcher
    // le visiteur de voir son message accepté (même logique que
    // recensement.js) — le message est de toute façon déjà en base, seule
    // l'alerte admin est perdue, pas la donnée.
    try {
      const finalSubject = subject || '(Sans objet)';
      await sendEmail(env, {
        to: notificationEmail,
        replyTo: email,
        subject: "Nouveau message — ANB Bordeaux",
        text: `Nouveau message de contact.\n\nNom : ${from_name}\nEmail : ${email}\nSujet : ${finalSubject}\n\n${content}\n\nÀ traiter dans l'espace Admin > Messages.`,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1F2925;line-height:1.6;max-width:520px;margin:0 auto;">
          <p><strong>Nouveau message de contact</strong></p>
          <p>Nom : ${escapeHtml(from_name)}<br />Email : ${escapeHtml(email)}<br />Sujet : ${escapeHtml(finalSubject)}</p>
          <p style="white-space:pre-wrap;">${escapeHtml(content)}</p>
          <p style="font-size:12px;color:#9aa39c;">À traiter dans l'espace Admin &gt; Messages.</p>
        </div>`,
      });
    } catch (mailError) {
      console.error("Notification admin (Resend) échouée :", mailError);
    }

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
