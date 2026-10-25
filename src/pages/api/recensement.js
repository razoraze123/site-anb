import { env } from "cloudflare:workers";
import { isRateLimited, tooManyRequests } from "../../lib/rateLimit.js";
import { formatNumeroAdherent, genererToken } from "../../lib/carteAdherent.js";

export const prerender = false;

export async function POST(context) {
  try {
    if (await isRateLimited(context.request, { bucket: 'recensement', limit: 5, windowSeconds: 600 })) {
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
    const insertResult = await db.prepare(
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

    // L'adhésion est déjà actée à ce stade (INSERT réussi) — tout ce qui
    // suit (numéro, token, carte PDF) est secondaire et ne doit jamais
    // pouvoir remettre en cause l'adhésion elle-même. id vient directement
    // de D1 (auto-incrément déjà garanti unique), jamais d'une valeur
    // fournie par le client — même pattern que admin/equipe.js,
    // admin/galerie.js (result.meta.last_row_id).
    const nouvelId = insertResult.meta.last_row_id;
    const numeroAdherent = formatNumeroAdherent(nouvelId, new Date().getUTCFullYear());

    // Le token de téléchargement (HMAC, voir lib/carteAdherent.js) est
    // optionnel dans cette réponse : si CARTE_HMAC_SECRET n'est pas encore
    // configuré, l'adhésion reste enregistrée et le numéro reste affiché —
    // seul le téléchargement immédiat de la carte devient indisponible
    // (le visiteur pourra la récupérer plus tard une fois le secret
    // configuré, ou via l'admin qui n'a pas besoin de ce token).
    let carteToken = null;
    try {
      carteToken = await genererToken(env, nouvelId);
    } catch (tokenError) {
      // Jamais le secret ni sa valeur dans les logs — juste le fait qu'il
      // manque, pour que l'admin sache quoi configurer.
      console.error("Génération du token de carte adhérent impossible (CARTE_HMAC_SECRET absent ou invalide) :", tokenError.message);
    }

    if (env.RESEND_API_KEY) {
      try {
        // identite_email centralisé (site_settings) plutôt qu'en dur ici —
        // repli sur l'adresse historique si le réglage n'existe pas encore.
        let contactEmail = 'anbordeaux33@outlook.fr';
        try {
          const setting = await db.prepare("SELECT value FROM site_settings WHERE key = 'identite_email'").first();
          if (setting?.value) contactEmail = setting.value;
        } catch { /* garde le repli ci-dessus */ }

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: "ANB Bordeaux <noreply@alphatoute.tech>",
            to: email.trim(),
            subject: "Bienvenue à l'ANB Bordeaux !",
            headers: {
              "List-Unsubscribe": `<mailto:${contactEmail}?subject=Desinscription>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
            },
            text: `Bonjour ${first_name.trim()},\n\nVotre adhésion à l'ANB Bordeaux a bien été enregistrée. Vous recevrez nos actualités, événements et annonces à cette adresse.\n\nÀ bientôt !\n\nL'équipe ANB Bordeaux\n${contactEmail}\n\nPour vous désinscrire, répondez à cet e-mail.`,
            html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1F2925;line-height:1.6;max-width:520px;margin:0 auto;">
              <p>Bonjour ${first_name.trim()},</p>
              <p>Votre adhésion à l'ANB Bordeaux a bien été enregistrée. Vous recevrez nos actualités, événements et annonces à cette adresse.</p>
              <p>À bientôt !</p>
              <p>L'équipe ANB Bordeaux</p>
              <hr style="border:none;border-top:1px solid #E3DCCB;margin:24px 0;" />
              <p style="font-size:12px;color:#9aa39c;">
                ANB Bordeaux · ${contactEmail}<br />
                Vous recevez cet e-mail suite à votre adhésion. <a href="mailto:${contactEmail}?subject=Desinscription" style="color:#9aa39c;">Se désinscrire</a>
              </p>
            </div>`
          })
        });
      } catch (mailError) {
        console.error("Resend send failed:", mailError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Recensement enregistré avec succès !",
      id: nouvelId,
      numero_adherent: numeroAdherent,
      // null si CARTE_HMAC_SECRET n'est pas configuré (voir plus haut) —
      // le front doit gérer ce cas (bouton de téléchargement indisponible).
      carte_token: carteToken,
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
