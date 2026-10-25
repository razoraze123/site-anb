import { env } from "cloudflare:workers";
import { requireRole, unauthorized } from "../../../lib/auth.js";
import { logActivity } from "../../../lib/journal.js";
import { sendEmail, escapeHtml } from "../../../lib/email.js";
import { isRateLimited, tooManyRequests } from "../../../lib/rateLimit.js";

export const prerender = false;

const MAX_REPONSE_LENGTH = 5000;

// Réponse à un message de contact — envoyée réellement au visiteur via
// Resend (remplace l'ancien lien mailto: "Répondre par e-mail", voir
// adminContent.js renderMessages()). L'ordre des opérations est
// volontaire : on n'écrit JAMAIS message_reponses ni ne change le statut
// tant que l'e-mail n'est pas parti avec succès — pas de "réponse envoyée"
// mensongère si Resend échoue.
export async function POST(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    // Garde-fou double-clic/double-envoi — même mécanisme que partout
    // ailleurs dans le projet (pas de nouveau système de rate limit), mais
    // identifié par l'admin authentifié (user.id, issu de requireRole() ci-
    // dessus donc de la session/D1, jamais d'une valeur envoyée par le
    // client) plutôt que par IP : cf-connecting-ip est absent en local
    // (throttle partagé artificiellement entre tous les essais) et, en
    // production, plusieurs admins peuvent se trouver derrière la même IP.
    if (await isRateLimited(context.request, { bucket: 'admin-reply', limit: 5, windowSeconds: 30, identifier: `admin:${user.id}` })) {
      return tooManyRequests();
    }

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const message_id = Number(body.message_id);
    const contenu = (body.contenu || '').trim();

    if (!message_id || !contenu) {
      return new Response(JSON.stringify({ error: "Les paramètres message_id et contenu sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (contenu.length > MAX_REPONSE_LENGTH) {
      return new Response(JSON.stringify({ error: "La réponse dépasse la longueur autorisée." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const message = await db.prepare("SELECT id, email, subject, from_name FROM messages WHERE id = ?").bind(message_id).first();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (!message.email) {
      return new Response(JSON.stringify({ error: "Ce message n'a pas d'adresse e-mail associée, impossible de répondre." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Reply-To centralisé (site_settings.identite_email) plutôt qu'en dur
    // ici — même lecture, même repli que recensement.js.
    let replyTo = 'anbordeaux33@outlook.fr';
    try {
      const setting = await db.prepare("SELECT value FROM site_settings WHERE key = 'identite_email'").first();
      if (setting?.value) replyTo = setting.value;
    } catch { /* garde le repli ci-dessus */ }

    const finalSubject = `Re: ${message.subject || '(Sans objet)'}`;

    try {
      await sendEmail(env, {
        to: message.email,
        replyTo,
        subject: finalSubject,
        text: contenu,
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1F2925;line-height:1.6;max-width:520px;margin:0 auto;">
          <p style="white-space:pre-wrap;">${escapeHtml(contenu)}</p>
          <hr style="border:none;border-top:1px solid #E3DCCB;margin:24px 0;" />
          <p style="font-size:12px;color:#9aa39c;">ANB Bordeaux</p>
        </div>`,
      });
    } catch (mailError) {
      console.error("Envoi de la réponse (Resend) échoué :", mailError);
      return new Response(JSON.stringify({ error: "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant." }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare(
      "INSERT INTO message_reponses (message_id, contenu, admin_id) VALUES (?, ?, ?)"
    ).bind(message_id, contenu, user.id).run();

    await db.prepare("UPDATE messages SET status = 'Traité' WHERE id = ?").bind(message_id).run();

    await logActivity(db, context, user, "Réponse à un message", `${message.from_name} — ${message.subject}`);

    return new Response(JSON.stringify({ success: true, message: "Réponse envoyée." }), {
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

// Suppression définitive d'un message. Réservée à admin/super_admin, et
// uniquement pour un message déjà archivé — garde-fou volontaire côté
// serveur (pas seulement caché côté front) pour éviter qu'on supprime un
// message actif par erreur ou via un appel direct à l'API.
export async function DELETE(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { searchParams } = new URL(context.request.url);
    const id = searchParams.get('id');
    if (!id) {
      return new Response(JSON.stringify({ error: "Le paramètre id est requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const message = await db.prepare("SELECT from_name, subject, status FROM messages WHERE id = ?").bind(id).first();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message introuvable." }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (message.status !== 'Archivé') {
      return new Response(JSON.stringify({ error: "Seul un message déjà archivé peut être supprimé." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    await db.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
    await logActivity(db, context, user, "Suppression d'un message", `${message.from_name} — ${message.subject}`);

    return new Response(JSON.stringify({ success: true, message: "Message supprimé." }), {
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

export async function PUT(context) {
  try {
    const user = await requireRole(context, ['admin', 'super_admin']);
    if (!user) return unauthorized();

    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ error: "La base de données D1 (DB) n'est pas configurée dans env. Veuillez vérifier wrangler.jsonc." }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await context.request.json();
    const { id, status } = body;

    if (id === undefined || !status) {
      return new Response(JSON.stringify({ error: "Les paramètres id et status sont requis." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Update statement
    const statement = db.prepare(
      "UPDATE messages SET status = ? WHERE id = ?"
    ).bind(status, id);

    const result = await statement.run();

    return new Response(JSON.stringify({
      success: true,
      message: `Statut du message mis à jour : ${status}`,
      data: result
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
